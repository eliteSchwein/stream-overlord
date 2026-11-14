#!/usr/bin/env python3
"""
Webcam privacy blur worker for Streambot.

Reads raw BGR frames from a capture ffmpeg process, pixelates faces and
license plates and writes the frames into an encoder ffmpeg process. Both
ffmpeg command lines are built by the Node backend (WebcamStreamHelper) and
passed in the JSON config, so raw frames never go through Node.

Each detector (faces, plates) runs in its own thread on the newest frame, so
a slow detector never lowers the output frame rate or the other detector's
rate. Detections arrive late and only a few times per second, so every blur
box follows its content with optical flow (BoxTracker): late detections are
moved to the current frame, and boxes are tracked frame by frame in between.
Boxes are padded and held briefly to cover single missed detections. Until
every detector finished its first run (models loading), and whenever one
failed, the whole frame is pixelated, so nothing leaks unblurred.

Status lines for the backend are written to stderr as "STATUS {json}".

Usage: blur_worker.py <config.json>
"""

import json
import os
import signal
import subprocess
import sys
import threading
import time

import cv2
import numpy as np

# Seconds a detected box stays blurred after it was last detected (covers
# movement between detections and single missed detections). Plates are
# usually parked or slow and their detector is slower, so they are held longer.
FACE_HOLD_SECONDS = 4.0
# Keep a face hidden for longer when optical flow can still follow its texture.
# A failed/ambiguous tracker falls back to the short detector-loss grace period.
FACE_RELIABLE_TRACK_SECONDS = 20.0
FACE_FLOW_GRACE_SECONDS = 1.5
# After this period without a model match, show TRACKING instead of a stale score.
FACE_FRESH_SECONDS = 0.75
PLATE_HOLD_SECONDS = 2.0
# Relative padding around detected boxes (covers movement and detector jitter).
FACE_PADDING = 0.3
PLATE_PADDING = 0.20
# Faces are detected on a frame scaled to at most this width. 960 finds faces
# down to ~35-40 px in a 720p/1080p frame (640 only down to ~50 px).
FACE_DETECT_WIDTH = 960
# False positives only blur a bit more, misses leak a face: favour recall.
FACE_THRESHOLD = 0.35
# A slightly lower threshold improves recall for EU plates, especially at an
# angle. The detector still supplies the true score for the debug overlay.
PLATE_THRESHOLD = 0.30
# Pixelation block count across a blurred region (lower = coarser).
PIXELATE_BLOCKS = 10


def status(**data):
    sys.stderr.write("STATUS " + json.dumps(data) + "\n")
    sys.stderr.flush()


def log(message):
    sys.stderr.write(f"blur worker: {message}\n")
    sys.stderr.flush()


# ---------------------------------------------------------------------------
# Detectors. detect(frame) returns (x1, y1, x2, y2, confidence) in frame pixels.
# ---------------------------------------------------------------------------


class YunetFaceDetector:
    """OpenCV YuNet face detector (CPU)."""

    name = "cpu"
    device = ""

    def __init__(self, model_path, max_width=FACE_DETECT_WIDTH, threshold=FACE_THRESHOLD):
        self.model_path = model_path
        self.max_width = max_width
        self.threshold = threshold
        self.detector = None
        self.input_size = None

    def detect(self, frame):
        height, width = frame.shape[:2]
        scale = min(1.0, self.max_width / width)
        size = (int(width * scale), int(height * scale))

        if self.detector is None:
            self.detector = cv2.FaceDetectorYN.create(self.model_path, "", size, self.threshold, 0.3, 5000)
            self.input_size = size
        elif self.input_size != size:
            self.detector.setInputSize(size)
            self.input_size = size

        image = frame if scale == 1.0 else cv2.resize(frame, size, interpolation=cv2.INTER_AREA)
        _, faces = self.detector.detect(image)
        if faces is None:
            return []

        boxes = []
        for face in faces:
            x, y, w, h = face[:4] / scale
            boxes.append((x, y, x + w, y + h, float(face[14])))
        return boxes


def square_tiles(height, width):
    """
    (x, y, w, h) tiles for square-input models. Letterboxing a 16:9 frame
    into a square input wastes ~45% of it; overlapping square tiles keep
    small objects detectable. Near-square frames are processed whole.
    """
    side = min(height, width)
    long_side = max(height, width)
    if long_side <= side * 1.2:
        return [(0, 0, width, height)]
    count = int(np.ceil(long_side / side))
    starts = np.linspace(0, long_side - side, count).astype(int)
    if width >= height:
        return [(int(start), 0, side, height) for start in starts]
    return [(0, int(start), width, side) for start in starts]


ORT_GPU_LABELS = {
    "CUDAExecutionProvider": "CUDA",
    "ROCMExecutionProvider": "ROCm",
    "MIGraphXExecutionProvider": "MIGraphX",
    "OpenVINOExecutionProvider": "OpenVINO",
}


def ort_session(model_path, use_gpu):
    """
    onnxruntime session, on the GPU if requested and the installed runtime
    supports it (CUDA, ROCm, OpenVINO), else on the CPU.
    Returns (session, "gpu" | "cpu", device label).
    """
    import onnxruntime as ort

    options = ort.SessionOptions()
    # Leave CPU for the encoder and the frame loop.
    options.intra_op_num_threads = max(1, (os.cpu_count() or 2) // 2)
    options.log_severity_level = 3

    if use_gpu:
        if hasattr(ort, "preload_dlls"):
            try:
                # CUDA/cuDNN come as pip wheels (nvidia-*); load them first.
                ort.preload_dlls()
            except Exception:  # noqa: BLE001
                pass
        available = ort.get_available_providers()
        providers = [provider for provider in ORT_GPU_LABELS if provider in available and provider != "OpenVINOExecutionProvider"]
        if "OpenVINOExecutionProvider" in available:
            providers.append(("OpenVINOExecutionProvider", {"device_type": "GPU"}))
        if providers:
            try:
                session = ort.InferenceSession(model_path, options, providers=providers + ["CPUExecutionProvider"])
                used = session.get_providers()[0]
                if used in ORT_GPU_LABELS:
                    return session, "gpu", ORT_GPU_LABELS[used]
            except Exception as error:  # noqa: BLE001
                log(f"GPU session for {os.path.basename(model_path)} failed: {error}")

    session = ort.InferenceSession(model_path, options, providers=["CPUExecutionProvider"])
    return session, "cpu", ""


YUNET_STRIDES = (8, 16, 32)


def decode_yunet(outputs, size, threshold):
    """
    Decodes raw YuNet outputs (cls x3, obj x3, bbox x3, kps x3 for strides
    8/16/32) of a size x size input into (x1, y1, x2, y2) boxes, as OpenCV's
    FaceDetectorYN does.
    """
    cls, obj, bbox = outputs[0:3], outputs[3:6], outputs[6:9]
    boxes, scores = [], []
    for index, stride in enumerate(YUNET_STRIDES):
        cols = size // stride
        score = np.sqrt(np.clip(cls[index].reshape(-1), 0, 1) * np.clip(obj[index].reshape(-1), 0, 1))
        keep = np.where(score >= threshold)[0]
        reg = bbox[index].reshape(-1, 4)
        for anchor in keep:
            row, col = divmod(int(anchor), cols)
            cx = (col + reg[anchor, 0]) * stride
            cy = (row + reg[anchor, 1]) * stride
            w = np.exp(reg[anchor, 2]) * stride
            h = np.exp(reg[anchor, 3]) * stride
            boxes.append([float(cx - w / 2), float(cy - h / 2), float(w), float(h)])
            scores.append(float(score[anchor]))

    result = []
    for index in np.array(cv2.dnn.NMSBoxes(boxes, scores, threshold, 0.3)).reshape(-1):
        x, y, w, h = boxes[int(index)]
        result.append((x, y, x + w, y + h, scores[int(index)]))
    return result


def letterbox_top_left(frame, size, dtype=np.uint8):
    """Scales frame into a size x size canvas at the top left corner."""
    height, width = frame.shape[:2]
    scale = min(size / width, size / height)
    resized = cv2.resize(frame, (max(1, int(width * scale)), max(1, int(height * scale))), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((size, size, 3), dtype=dtype)
    canvas[: resized.shape[0], : resized.shape[1]] = resized
    return canvas, scale


class OrtYunetFaceDetector:
    """YuNet on the GPU through onnxruntime (CUDA / ROCm / OpenVINO)."""

    def __init__(self, model_path, threshold=FACE_THRESHOLD):
        self.session, self.name, self.device = ort_session(model_path, use_gpu=True)
        if self.name != "gpu":
            raise RuntimeError("no GPU runtime available (install the privacy blur on a machine with a supported GPU)")
        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name
        self.size = int(model_input.shape[2]) if isinstance(model_input.shape[2], int) else 640
        self.threshold = threshold

    def detect(self, frame):
        result = []
        for x, y, w, h in square_tiles(*frame.shape[:2]):
            canvas, scale = letterbox_top_left(frame[y:y + h, x:x + w], self.size, np.float32)
            # BGR 0-255, NCHW, like OpenCV feeds YuNet.
            outputs = self.session.run(None, {self.input_name: np.ascontiguousarray(canvas.transpose(2, 0, 1))[None]})
            result += [
                (bx1 / scale + x, by1 / scale + y, bx2 / scale + x, by2 / scale + y, confidence)
                for bx1, by1, bx2, by2, confidence in decode_yunet(outputs, self.size, self.threshold)
            ]
        return result


CORAL_USB_IDS = {("1a6e", "089a"), ("18d1", "9302")}


def check_coral_access():
    """
    libedgetpu only reports "Failed to load delegate"; name the usual cause
    (no permission on the USB device, i.e. the udev rule is missing).
    """
    found = False
    for apex in sorted(entry for entry in os.listdir("/dev") if entry.startswith("apex_")):
        found = True
        if not os.access(f"/dev/{apex}", os.R_OK | os.W_OK):
            raise RuntimeError(f"no permission to open /dev/{apex} (add the user to the apex group)")

    base = "/sys/bus/usb/devices"
    for entry in os.listdir(base) if os.path.isdir(base) else []:
        try:
            with open(f"{base}/{entry}/idVendor") as vendor, open(f"{base}/{entry}/idProduct") as product:
                ids = (vendor.read().strip(), product.read().strip())
            if ids not in CORAL_USB_IDS:
                continue
            with open(f"{base}/{entry}/busnum") as bus, open(f"{base}/{entry}/devnum") as dev:
                node = f"/dev/bus/usb/{int(bus.read()):03d}/{int(dev.read()):03d}"
        except OSError:
            continue
        found = True
        if not os.access(node, os.R_OK | os.W_OK):
            raise RuntimeError(
                f"no permission to open the Coral USB device {node}: the udev rule is missing "
                "(run scripts/install_coral_udev.sh), then replug the Coral"
            )

    if not found:
        raise RuntimeError("no Coral Edge TPU found")


class CoralFaceDetector:
    """SSD MobileNet v2 face detector on a Coral Edge TPU."""

    name = "coral"

    def __init__(self, model_path, device=None, threshold=FACE_THRESHOLD):
        try:
            from ai_edge_litert.interpreter import Interpreter, load_delegate
        except ImportError:
            from tflite_runtime.interpreter import Interpreter, load_delegate

        check_coral_access()
        # device: "usb:0", "usb:1", "pci:0", ... picks one Edge TPU when
        # several are connected (each camera gets its own).
        self.device = device or ""
        delegate = load_delegate("libedgetpu.so.1", {"device": device} if device else {})
        self.interpreter = Interpreter(model_path=model_path, experimental_delegates=[delegate])
        self.interpreter.allocate_tensors()
        self.input = self.interpreter.get_input_details()[0]
        self.input_height, self.input_width = (int(value) for value in self.input["shape"][1:3])
        self.threshold = threshold
        self.outputs = self._map_outputs()
        # Coral's SSD face model favors frontal faces. OpenCV's bundled
        # profile cascade adds a CPU fallback for faces viewed from the side.
        # No additional download or API setting is required.
        self.profile = None
        # Some embedded/minimal OpenCV builds omit objdetect (CascadeClassifier)
        # or the bundled Haar cascade data. This optional CPU enhancement must
        # never make a working Edge TPU detector fall back to CPU.
        try:
            cascade_factory = getattr(cv2, "CascadeClassifier", None)
            cascade_dir = getattr(getattr(cv2, "data", None), "haarcascades", None)
            if cascade_factory is None or not cascade_dir:
                raise RuntimeError("OpenCV was built without CascadeClassifier or Haar cascade data")
            cascade_path = os.path.join(cascade_dir, "haarcascade_profileface.xml")
            if not os.path.isfile(cascade_path):
                raise FileNotFoundError(cascade_path)
            profile = cascade_factory(cascade_path)
            if profile.empty():
                raise RuntimeError("profile face cascade failed to load")
            self.profile = profile
        except Exception as error:  # optional fallback; keep Coral initialized
            log(f"CPU side-profile detection unavailable ({error}); Coral face detection remains active")

    def _profile_faces(self, frame):
        if self.profile is None:
            return []
        height, width = frame.shape[:2]
        scale = min(1.0, 640.0 / max(width, height))
        small = frame if scale == 1.0 else cv2.resize(
            frame, (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA)
        gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
        result = []
        # The cascade only recognizes one profile direction; mirror to detect
        # the other direction. These are heuristic detections, not probabilities.
        for mirrored in (False, True):
            source = cv2.flip(gray, 1) if mirrored else gray
            faces = self.profile.detectMultiScale(
                source, scaleFactor=1.12, minNeighbors=4,
                minSize=(max(20, round(34 * scale)), max(20, round(34 * scale))))
            for x, y, w, h in faces:
                if mirrored:
                    x = gray.shape[1] - x - w
                box = (x / scale, y / scale, (x + w) / scale, (y + h) / scale)
                if not any(iou(box, previous[:4]) > 0.35 for previous in result):
                    result.append((*box, None))
        return result

    def _map_outputs(self):
        # The SSD postprocess op names its outputs "<op>", "<op>:1", "<op>:2",
        # "<op>:3" = boxes [1,N,4], classes [1,N], scores [1,N], count [1].
        details = self.interpreter.get_output_details()
        if len(details) != 4:
            raise RuntimeError(f"unexpected detection model with {len(details)} outputs")

        def suffix(detail):
            name = detail["name"]
            return int(name.rsplit(":", 1)[1]) if ":" in name and name.rsplit(":", 1)[1].isdigit() else 0

        ordered = sorted(details, key=suffix)
        mapping = dict(zip(("boxes", "classes", "scores", "count"), (d["index"] for d in ordered)))

        boxes_shape = list(ordered[0]["shape"])
        if not (len(boxes_shape) == 3 and boxes_shape[-1] == 4) or int(np.prod(ordered[3]["shape"])) != 1:
            raise RuntimeError("unexpected output layout of the detection model")
        return mapping

    def detect(self, frame):
        height, width = frame.shape[:2]
        # Preserve aspect ratio: resizing a 16:9 frame straight to the square
        # Coral input makes small faces very narrow and difficult to detect.
        # Overlapping square crops also increase effective face resolution.
        result = []
        for ox, oy, tw, th in square_tiles(height, width):
            crop = frame[oy:oy + th, ox:ox + tw]
            image = cv2.resize(crop, (self.input_width, self.input_height), interpolation=cv2.INTER_AREA)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            self.interpreter.set_tensor(self.input["index"], np.expand_dims(image, 0).astype(self.input["dtype"]))
            self.interpreter.invoke()

            boxes = self.interpreter.get_tensor(self.outputs["boxes"])[0]
            scores = self.interpreter.get_tensor(self.outputs["scores"])[0]
            count = int(np.squeeze(self.interpreter.get_tensor(self.outputs["count"])))
            for index in range(min(count, len(scores))):
                if scores[index] < self.threshold:
                    continue
                y1, x1, y2, x2 = boxes[index]
                box = (max(0, x1 * tw + ox), max(0, y1 * th + oy),
                       min(width, x2 * tw + ox), min(height, y2 * th + oy))
                if box[2] <= box[0] or box[3] <= box[1]:
                    continue
                # Deduplicate overlapping tile predictions.
                if not any(iou(box, previous[:4]) > 0.45 for previous in result):
                    result.append((*box, float(scores[index])))
        # An extra side-profile pass catches faces the TPU's frontal model
        # does not recognize. Preserve the TPU prediction when boxes overlap.
        for box in self._profile_faces(frame):
            if not any(iou(box[:4], previous[:4]) > 0.30 for previous in result):
                result.append(box)
        return result


class RknnYunetFaceDetector:
    """YuNet converted to RKNN (Rockchip NPU), decoded in numpy."""

    name = "rknn"
    device = ""

    def __init__(self, model_path, input_size=640, threshold=FACE_THRESHOLD):
        from rknnlite.api import RKNNLite

        self.rknn = RKNNLite()
        if self.rknn.load_rknn(model_path) != 0:
            raise RuntimeError(f"failed to load {model_path}")
        if self.rknn.init_runtime(core_mask=RKNNLite.NPU_CORE_AUTO) != 0:
            raise RuntimeError("failed to init the rknn runtime")
        self.size = input_size
        self.threshold = threshold

    def detect(self, frame):
        result = []
        for x, y, w, h in square_tiles(*frame.shape[:2]):
            canvas, scale = letterbox_top_left(frame[y:y + h, x:x + w], self.size)
            outputs = self.rknn.inference(inputs=[np.expand_dims(canvas, 0)], data_format="nhwc")
            result += [
                (bx1 / scale + x, by1 / scale + y, bx2 / scale + x, by2 / scale + y, confidence)
                for bx1, by1, bx2, by2, confidence in decode_yunet(outputs, self.size, self.threshold)
            ]
        return result


def merge_plate_detections(detections, width, height, overlap=0.45):
    """Merge overlapping detections from different tiles and zoom levels.

    Keep the highest *model* confidence, never average confidence values or
    replace them with an invented certainty for the debugging overlay.
    """
    filtered = []
    for x1, y1, x2, y2, confidence in detections:
        if not np.isfinite([x1, y1, x2, y2, confidence]).all():
            continue
        box = (max(0.0, min(width, x1)), max(0.0, min(height, y1)),
               max(0.0, min(width, x2)), max(0.0, min(height, y2)))
        if box[2] - box[0] < 5 or box[3] - box[1] < 3:
            continue
        filtered.append((*box, float(confidence)))

    result = []
    for candidate in sorted(filtered, key=lambda item: item[4], reverse=True):
        if not any(iou(candidate[:4], previous[:4]) >= overlap for previous in result):
            result.append(candidate)
    return result


class OnnxPlateDetector:
    """YOLOv9 general license-plate model (ONNX, CPU or GPU).

    Overlapping square crops preserve image detail in widescreen feeds. A
    second, closer crop pass is used only when the first pass found nothing:
    small / distant plates benefit, without always doubling inference work.
    This improves *recall*; it does not make the model EU-specific.
    """

    def __init__(self, model_path, use_gpu=False, threshold=PLATE_THRESHOLD):
        self.session, self.name, self.device = ort_session(model_path, use_gpu)
        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name
        self.size = int(model_input.shape[2]) if isinstance(model_input.shape[2], int) else 384
        self.threshold = threshold

    @staticmethod
    def closeup_tiles(height, width):
        """Overlapping zoom crops for plates too small in the standard pass."""
        side = int(min(height, width) * 0.7)
        if side < 320:
            return []
        xs = np.linspace(0, width - side, max(1, int(np.ceil(width / side))))
        ys = np.linspace(0, height - side, max(1, int(np.ceil(height / side))))
        return [(int(round(x)), int(round(y)), side, side) for y in ys for x in xs]

    def detect(self, frame):
        height, width = frame.shape[:2]
        result = []
        for x, y, w, h in square_tiles(height, width):
            result.extend(
                (x1 + x, y1 + y, x2 + x, y2 + y, confidence)
                for x1, y1, x2, y2, confidence in self._detect_tile(frame[y:y + h, x:x + w])
            )

        if not result:
            # This is more expensive, so don't run it when ordinary detection
            # succeeds. The thread consumes only the newest frame and never
            # blocks video encoding.
            for x, y, w, h in self.closeup_tiles(height, width):
                result.extend(
                    (x1 + x, y1 + y, x2 + x, y2 + y, confidence)
                    for x1, y1, x2, y2, confidence in self._detect_tile(frame[y:y + h, x:x + w])
                )

        return merge_plate_detections(result, width, height)

    def _detect_tile(self, frame):
        height, width = frame.shape[:2]
        ratio = min(self.size / height, self.size / width)
        new_w, new_h = int(round(width * ratio)), int(round(height * ratio))
        pad_w, pad_h = (self.size - new_w) / 2, (self.size - new_h) / 2

        image = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        top, bottom = int(round(pad_h - 0.1)), int(round(pad_h + 0.1))
        left, right = int(round(pad_w - 0.1)), int(round(pad_w + 0.1))
        image = cv2.copyMakeBorder(image, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
        tensor = image.transpose((2, 0, 1))[::-1].astype(np.float32) / 255.0

        predictions = self.session.run(None, {self.input_name: np.expand_dims(np.ascontiguousarray(tensor), 0)})[0]

        result = []
        # End-to-end model: [batch, x1, y1, x2, y2, class, score].
        for row in predictions.reshape(-1, 7):
            if row[6] < self.threshold:
                continue
            result.append((
                (row[1] - pad_w) / ratio,
                (row[2] - pad_h) / ratio,
                (row[3] - pad_w) / ratio,
                (row[4] - pad_h) / ratio,
                float(row[6]),
            ))
        return result


def create_plate_detector(models_dir, use_gpu):
    # plate_640.onnx since the detection quality update; older installs only
    # have the weaker 384 model as plate.onnx.
    for name in ("plate_640.onnx", "plate.onnx"):
        model = os.path.join(models_dir, name)
        if os.path.exists(model):
            detector = OnnxPlateDetector(model, use_gpu=use_gpu)
            warnings = ["gpu: no usable GPU runtime, plates are detected on the CPU"] if use_gpu and detector.name != "gpu" else []
            return detector, warnings
    raise RuntimeError("no license plate model installed")


def create_face_detector(accelerator, models_dir):
    """
    accelerator: "coral" (any), "coral:usb:1" / "coral:pci:0" (one Edge TPU),
    "gpu", "rknn", "cpu" or "auto" (legacy). The backend assigns them per
    camera. Any failure falls back to the CPU so the blur keeps working.
    Returns (detector, {failed backend: error}).
    """
    face_onnx = os.path.join(models_dir, "face_yunet.onnx")
    attempts = []
    if accelerator.startswith("coral"):
        device = accelerator.split(":", 1)[1] if ":" in accelerator else None
        attempts.append(("coral", lambda: CoralFaceDetector(os.path.join(models_dir, "face_coral_edgetpu.tflite"), device)))
    elif accelerator == "gpu":
        attempts.append(("gpu", lambda: OrtYunetFaceDetector(face_onnx)))
    elif accelerator == "rknn":
        attempts.append(("rknn", lambda: RknnYunetFaceDetector(os.path.join(models_dir, "face_yunet.rknn"))))
    elif accelerator == "auto":
        attempts.append(("coral", lambda: CoralFaceDetector(os.path.join(models_dir, "face_coral_edgetpu.tflite"))))
        attempts.append(("rknn", lambda: RknnYunetFaceDetector(os.path.join(models_dir, "face_yunet.rknn"))))
    attempts.append(("cpu", lambda: YunetFaceDetector(face_onnx)))

    errors = {}
    for name, factory in attempts:
        try:
            return factory(), errors
        except Exception as error:  # noqa: BLE001 - any failure falls back
            errors[name] = str(error)
    raise RuntimeError(f"no face detector available: {errors}")


# ---------------------------------------------------------------------------
# Frame processing
# ---------------------------------------------------------------------------


def pixelate(frame, x1, y1, x2, y2):
    region = frame[y1:y2, x1:x2]
    h, w = region.shape[:2]
    if h < 2 or w < 2:
        return
    blocks_x = max(1, min(PIXELATE_BLOCKS, w // 4))
    blocks_y = max(1, round(blocks_x * h / w))
    small = cv2.resize(region, (blocks_x, blocks_y), interpolation=cv2.INTER_AREA)
    frame[y1:y2, x1:x2] = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)


def pad_box(box, padding, width, height):
    x1, y1, x2, y2 = box
    pw, ph = (x2 - x1) * padding, (y2 - y1) * padding
    return (
        max(0, int(x1 - pw)),
        max(0, int(y1 - ph)),
        min(width, int(x2 + pw)),
        min(height, int(y2 + ph)),
    )


class WorkerStatus:
    """Detector info merged from all detection threads, reported as one."""

    def __init__(self):
        self.lock = threading.Lock()
        self.detectors = {}
        self.devices = {}
        self.warnings = []
        self.detection_fps = {}

    def update(self, kind, detector=None, device=None, warnings=None, fps=None):
        with self.lock:
            if detector is not None:
                self.detectors[kind] = detector
            if device:
                self.devices[kind] = device
            if warnings:
                self.warnings.extend(warnings)
            if fps is not None:
                self.detection_fps[kind] = fps
            status(
                state="detecting",
                detectors=dict(self.detectors),
                devices=dict(self.devices),
                warnings=list(self.warnings),
                detection_fps=dict(self.detection_fps),
            )


class DetectionThread(threading.Thread):
    """
    Runs one detector on the newest frame, as fast as it can. Each detector
    has its own thread so a slow one (plates) never lowers the detection rate
    of another (faces). Results carry the id of the frame they were detected
    on; the main loop moves them to the current frame (BoxTracker).
    """

    def __init__(self, kind, factory, padding, hold_seconds, worker_status):
        super().__init__(daemon=True)
        self.kind = kind
        self.factory = factory
        self.padding = padding
        self.hold_seconds = hold_seconds
        self.worker_status = worker_status
        self.lock = threading.Lock()
        self.frame = None
        self.frame_id = 0
        self.frame_event = threading.Event()
        self.results = []  # [(frame_id, [(x1, y1, x2, y2, confidence), ...])]
        self.ready = False
        self.failed = False
        self.stopped = False

    def submit(self, frame, frame_id):
        # Only the newest frame matters; never queue.
        if not self.frame_event.is_set():
            self.frame = frame.copy()
            self.frame_id = frame_id
            self.frame_event.set()

    def take_results(self):
        with self.lock:
            results, self.results = self.results, []
            return results

    def run(self):
        try:
            detector, warnings = self.factory()
        except Exception as error:  # noqa: BLE001
            self.failed = True
            status(state="error", error=f"failed to load the {self.kind} detector: {error}")
            return

        self.worker_status.update(
            self.kind, detector=detector.name, device=getattr(detector, "device", ""), warnings=warnings,
        )

        runs = 0
        started = time.monotonic()
        while not self.stopped:
            if not self.frame_event.wait(timeout=1):
                continue
            frame, frame_id = self.frame, self.frame_id

            try:
                boxes = [tuple(float(value) if value is not None else None for value in box)
                         for box in detector.detect(frame)]
            except Exception as error:  # noqa: BLE001
                self.failed = True
                status(state="error", error=f"{self.kind} detection failed: {error}")
                return
            finally:
                self.frame_event.clear()

            with self.lock:
                self.results.append((frame_id, boxes))
            self.ready = True

            runs += 1
            elapsed = time.monotonic() - started
            if elapsed >= 5:
                self.worker_status.update(self.kind, fps=round(runs / elapsed, 1))
                runs, started = 0, time.monotonic()


# Grayscale width used for optical flow (cheap, still precise enough).
TRACK_WIDTH = 480
# Frames kept to move late detections to the current frame (~3 s at 30 fps).
TRACK_HISTORY = 90
# Moving boxes get extra margin: speed (px/frame) times this many frames.
MOTION_MARGIN_FRAMES = 3
LK_PARAMS = dict(
    winSize=(21, 21),
    maxLevel=4,
    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 20, 0.03),
)


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


class TrackedBox:
    def __init__(self, kind, box, points, expires):
        self.kind = kind
        self.box = list(box)  # full resolution x1, y1, x2, y2
        self.confidence = None
        self.points = points  # Nx1x2 float32 in tracking resolution, or None
        self.expires = expires
        self.last_detected = time.monotonic()
        self.velocity = (0.0, 0.0)  # px per frame, full resolution
        self.last_flow_ok = self.last_detected
        self.flow_ok = False


class BoxTracker:
    """
    Keeps blur boxes on their content between detections.

    Detections arrive several frames late (inference time) and only a few
    times per second; moving faces/plates would leave their box in between.
    Every box is moved with sparse optical flow (Lucas-Kanade) from frame to
    frame, and a late detection is first moved from the frame it was detected
    on to the current frame.
    """

    def __init__(self, width, height):
        self.scale = min(1.0, TRACK_WIDTH / width)
        self.size = (max(1, int(width * self.scale)), max(1, int(height * self.scale)))
        self.width, self.height = width, height
        self.history = {}  # frame_id -> small gray frame
        self.previous = None
        self.boxes = []

    def _gray(self, frame):
        small = cv2.resize(frame, self.size, interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    def _points(self, gray, box):
        s = self.scale
        x1, y1 = max(0, int(box[0] * s)), max(0, int(box[1] * s))
        x2, y2 = min(self.size[0], int(box[2] * s) + 1), min(self.size[1], int(box[3] * s) + 1)
        if x2 - x1 < 2 or y2 - y1 < 2:
            return None
        mask = np.zeros_like(gray)
        mask[y1:y2, x1:x2] = 255
        points = cv2.goodFeaturesToTrack(gray, maxCorners=30, qualityLevel=0.01, minDistance=2, mask=mask)
        if points is None or len(points) < 4:
            # Too little texture: track a grid instead.
            xs = np.linspace(x1, x2 - 1, 4)
            ys = np.linspace(y1, y2 - 1, 4)
            points = np.array([[[x, y]] for y in ys for x in xs], dtype=np.float32)
        return points.astype(np.float32)

    def _flow(self, old_gray, new_gray, box, points):
        """Track points with forward/backward validation to reject background drift."""
        if points is None or len(points) < 4:
            return box, None, (0.0, 0.0)
        moved, found, _ = cv2.calcOpticalFlowPyrLK(old_gray, new_gray, points, None, **LK_PARAMS)
        if moved is None or found is None:
            return box, None, (0.0, 0.0)
        back, back_found, _ = cv2.calcOpticalFlowPyrLK(new_gray, old_gray, moved, None, **LK_PARAMS)
        if back is None or back_found is None:
            return box, None, (0.0, 0.0)
        errors = np.linalg.norm((back - points).reshape(-1, 2), axis=1)
        good = ((found.reshape(-1) == 1) & (back_found.reshape(-1) == 1)
                & np.isfinite(errors) & (errors < 1.5))
        if good.sum() < max(4, int(len(points) * 0.25)):
            return box, None, (0.0, 0.0)
        shifts = (moved[good] - points[good]).reshape(-1, 2)
        median = np.median(shifts, axis=0)
        deviations = np.linalg.norm(shifts - median, axis=1)
        consistent = deviations < max(2.0, min(self.size) * 0.015)
        if consistent.sum() < 4:
            return box, None, (0.0, 0.0)
        delta = np.median(shifts[consistent], axis=0) / self.scale
        # A wildly jumping flow estimate must not throw the privacy box away.
        if np.linalg.norm(delta) > max(12.0, self.width * 0.04):
            return box, None, (0.0, 0.0)
        shifted = [box[0] + delta[0], box[1] + delta[1],
                   box[2] + delta[0], box[3] + delta[1]]
        return shifted, moved[good][consistent].reshape(-1, 1, 2), (float(delta[0]), float(delta[1]))

    def update(self, frame, frame_id, results, hold_seconds):
        """
        frame: current full resolution frame; results: {kind: [(det_frame_id,
        boxes)]} from the detection threads. Returns boxes for this frame.
        """
        gray = self._gray(frame)
        now = time.monotonic()

        # 1. Follow existing boxes from the previous frame to this one.
        if self.previous is not None:
            for tracked in self.boxes:
                tracked.box, tracked.points, delta = self._flow(self.previous, gray, tracked.box, tracked.points)
                tracked.flow_ok = tracked.points is not None
                if tracked.flow_ok:
                    tracked.last_flow_ok = now
                    # Refresh feature points within the current moving region.
                    if len(tracked.points) < 8:
                        extra = self._points(gray, tracked.box)
                        if extra is not None:
                            tracked.points = extra
                elif now - tracked.last_detected < FACE_FRESH_SECONDS:
                    # New detection can initialize a fresh set of features.
                    tracked.points = self._points(gray, tracked.box)
                tracked.velocity = (
                    0.5 * tracked.velocity[0] + 0.5 * delta[0],
                    0.5 * tracked.velocity[1] + 0.5 * delta[1],
                )

        # 2. Add new detections, moved from their frame to this one.
        for kind, kind_results in results.items():
            for det_frame_id, boxes in kind_results:
                old_gray = self.history.get(det_frame_id)
                for detection in boxes:
                    box, confidence = detection[:4], detection[4]
                    velocity = (0.0, 0.0)
                    if old_gray is not None and det_frame_id != frame_id:
                        box, points, delta = self._flow(old_gray, gray, list(box), self._points(old_gray, box))
                        frames = max(1, frame_id - det_frame_id)
                        velocity = (delta[0] / frames, delta[1] / frames)
                        if points is None:
                            points = self._points(gray, box)
                    else:
                        points = self._points(gray, box)

                    # A detection refreshes the tracked box it matches.
                    self.boxes = [
                        tracked for tracked in self.boxes
                        if tracked.kind != kind or iou(tracked.box, box) < 0.3
                    ]
                    tracked = TrackedBox(kind, box, points, now + hold_seconds[kind])
                    tracked.confidence = confidence
                    tracked.last_detected = now
                    tracked.velocity = velocity
                    tracked.last_flow_ok = now
                    self.boxes.append(tracked)

        # A confident flow track survives temporary model misses (hands,
        # profile turns), but never beyond a bounded interval without a new
        # AI detection. If flow fails, retain the ordinary 4-second grace.
        self.boxes = [
            tracked for tracked in self.boxes
            if tracked.expires > now or (
                tracked.kind == "face"
                and now - tracked.last_detected < FACE_RELIABLE_TRACK_SECONDS
                and now - tracked.last_flow_ok < FACE_FLOW_GRACE_SECONDS
                and tracked.flow_ok
            )
        ]

        self.history[frame_id] = gray
        self.history.pop(frame_id - TRACK_HISTORY, None)
        self.previous = gray
        result = []
        for tracked in self.boxes:
            # Grow moving boxes by their recent motion (the next detection /
            # flow update lags a little behind fast movement).
            mx = abs(tracked.velocity[0]) * MOTION_MARGIN_FRAMES
            my = abs(tracked.velocity[1]) * MOTION_MARGIN_FRAMES
            x1, y1, x2, y2 = tracked.box
            # A confidence score describes the original detector prediction,
            # not the quality of tracking while the face is obscured.
            fresh = tracked.kind != "face" or now - tracked.last_detected < FACE_FRESH_SECONDS
            confidence = tracked.confidence if fresh else None
            result.append((tracked.kind, [x1 - mx, y1 - my, x2 + mx, y2 + my], confidence, not fresh))
        return result


def create_detection_threads(config):
    models_dir = config["models_dir"]
    # Assigned per camera by the backend; "accelerator" is the older key.
    face_accelerator = config.get("face_accelerator", config.get("accelerator", "auto"))
    plate_on_gpu = config.get("plate_accelerator", "cpu") == "gpu"
    worker_status = WorkerStatus()
    threads = []

    if config.get("faces"):
        def face_factory():
            detector, errors = create_face_detector(face_accelerator, models_dir)
            warnings = []
            requested = face_accelerator.split(":", 1)[0]
            for name, error in errors.items():
                log(f"{name} face detector unavailable: {error}")
                # Shown in the admin UI when the assigned accelerator failed.
                if name == requested:
                    warnings.append(f"{name}: {error}")
            return detector, warnings

        threads.append(DetectionThread("face", face_factory, FACE_PADDING, FACE_HOLD_SECONDS, worker_status))

    if config.get("plates"):
        threads.append(DetectionThread(
            "plate", lambda: create_plate_detector(models_dir, plate_on_gpu), PLATE_PADDING, PLATE_HOLD_SECONDS, worker_status,
        ))

    return threads



def draw_debug_label(frame, label, x1, y1, color):
    height, width = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.8, min(1.6, min(width, height) / 720))
    thickness = max(2, round(scale * 2))
    (tw, th), baseline = cv2.getTextSize(label, font, scale, thickness)
    margin = max(5, round(scale * 7))
    left = min(max(0, x1), max(0, width - tw - margin * 2))
    top = y1 - th - baseline - margin * 2 - 4
    if top < 0:
        top = min(height - th - baseline - margin * 2, y1 + 4)
    top = max(0, top)
    cv2.rectangle(frame, (left, top), (left + tw + margin * 2,
                  top + th + baseline + margin * 2), color, -1)
    cv2.putText(frame, label, (left + margin, top + margin + th),
                font, scale, (0, 0, 0), thickness, cv2.LINE_AA)


def draw_debug_hud(frame, label):
    height, width = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.55, min(1.2, min(width, height) / 950))
    thickness = max(1, round(scale * 2))
    (tw, th), baseline = cv2.getTextSize(label, font, scale, thickness)
    padding = max(6, round(scale * 10))
    # Scale down long HUD text on narrow video frames.
    if tw + padding * 2 > width:
        scale *= (width - padding * 2) / max(1, tw)
        scale = max(0.3, scale)
        (tw, th), baseline = cv2.getTextSize(label, font, scale, thickness)
    cv2.rectangle(frame, (0, 0), (min(width - 1, tw + padding * 2),
                  min(height - 1, th + baseline + padding * 2)), (25, 25, 25), -1)
    cv2.putText(frame, label, (padding, padding + th), font, scale,
                (255, 255, 255), thickness, cv2.LINE_AA)


def main():
    with open(sys.argv[1], encoding="utf-8") as handle:
        config = json.load(handle)

    width, height = int(config["width"]), int(config["height"])
    frame_size = width * height * 3

    capture = subprocess.Popen(config["capture_args"], stdout=subprocess.PIPE, bufsize=frame_size)
    encoder = subprocess.Popen(config["encode_args"], stdin=subprocess.PIPE, bufsize=frame_size)

    def shutdown(*_):
        stop_processes(capture, encoder)
        # os._exit: native detector threads (onnxruntime, OpenCV) can block a
        # regular interpreter shutdown.
        os._exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    blur = bool(config.get("blur_faces", config.get("faces")) or config.get("blur_plates", config.get("plates")))
    show_detections = bool(config.get("show_detections"))
    detection = create_detection_threads(config)
    for thread in detection:
        thread.start()
    tracker = BoxTracker(width, height) if detection else None
    padding = {thread.kind: thread.padding for thread in detection}
    hold_seconds = {thread.kind: thread.hold_seconds for thread in detection}
    frame_id = 0

    frames = 0
    started = time.monotonic()
    status(state="starting", blur=blur)

    try:
        while True:
            data = capture.stdout.read(frame_size)
            if not data or len(data) < frame_size:
                break

            frame = np.frombuffer(data, dtype=np.uint8).reshape((height, width, 3)).copy()

            if detection:
                frame_id += 1
                for thread in detection:
                    thread.submit(frame, frame_id)
                results = {thread.kind: thread.take_results() for thread in detection}
                boxes = tracker.update(frame, frame_id, results, hold_seconds)

                if blur and any(
                    (thread.kind == "face" and config.get("blur_faces", True)
                     or thread.kind == "plate" and config.get("blur_plates", True))
                    and (thread.failed or not thread.ready) for thread in detection
                ):
                    # Fail closed: nothing leaves unblurred while any detector
                    # is loading or broken.
                    pixelate(frame, 0, 0, width, height)
                else:
                    for kind, box, confidence, tracking_only in boxes:
                        if config.get("blur_faces" if kind == "face" else "blur_plates", True):
                            pixelate(frame, *pad_box(box, padding[kind], width, height))

                if show_detections:
                    # Always render debug feedback, including during startup,
                    # when no objects were found, or when blur fails closed.
                    for kind, box, confidence, tracking_only in boxes:
                        x1, y1, x2, y2 = pad_box(box, padding[kind], width, height)
                        color = (80, 220, 80) if kind == "face" else (0, 190, 255)
                        thickness = max(2, round(min(width, height) / 360))
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
                        label = ("FACE TRACKING" if tracking_only else
                                 f"{kind.upper()} {confidence * 100:.0f}%" if confidence is not None else
                                 "FACE PROFILE" if kind == "face" else kind.upper())
                        draw_debug_label(frame, label, x1, y1, color)

                    face_count = sum(kind == "face" for kind, _, _, _ in boxes)
                    plate_count = sum(kind == "plate" for kind, _, _, _ in boxes)
                    pending = [t.kind.upper() for t in detection if not t.ready and not t.failed]
                    failed = [t.kind.upper() for t in detection if t.failed]
                    state = ("ERROR: " + ",".join(failed) if failed else
                             "LOADING: " + ",".join(pending) if pending else "ACTIVE")
                    draw_debug_hud(frame, f"AI DEBUG | {state} | FACE {face_count} | PLATE {plate_count}")

            encoder.stdin.write(frame.tobytes())

            frames += 1
            elapsed = time.monotonic() - started
            if elapsed >= 5:
                status(state="streaming", fps=round(frames / elapsed, 1))
                frames, started = 0, time.monotonic()
    except BrokenPipeError:
        log("encoder closed its input")
    finally:
        for thread in detection:
            thread.stopped = True
        stop_processes(capture, encoder)

    # The stream only ends when the camera or the encoder stopped, which is
    # always unexpected for a live stream: exit non-zero so the backend restarts.
    sys.stdout.flush()
    os._exit(1)


def stop_processes(capture, encoder):
    # Closing stdin lets the encoder flush and exit; ffmpeg ignores SIGTERM
    # while it is blocked reading its input.
    try:
        encoder.stdin.close()
    except (BrokenPipeError, OSError):
        pass
    if capture.poll() is None:
        capture.terminate()
    for process in (encoder, capture):
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()

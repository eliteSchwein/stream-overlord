#!/usr/bin/env bash
# Installs the webcam privacy blur (face + license plate) for Streambot:
#  - a Python venv with OpenCV and onnxruntime (CPU detectors)
#  - the detection models
#  - Coral Edge TPU runtime when a Coral is connected
#  - Rockchip NPU runtime + a converted face model on Rockchip SoCs
#
# Progress lines start with "Step:" so the backend can show them.
# Exit codes: 0 = installed, 1 = failed, 2 = system packages missing and
#             cannot be installed without a password.
set -euo pipefail

DATA_DIR="${WEBCAM_BLUR_ROOT:-${HOME}/.local/share/streambot/webcam}"
VENV="${DATA_DIR}/venv"
MODELS="${DATA_DIR}/models"
LIB_DIR="${DATA_DIR}/lib"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

FACE_MODEL_URL="https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx"
# 640 px input: the 384 px variant misses most plates at webcam distances.
PLATE_MODEL_URL="https://github.com/ankandrew/open-image-models/releases/download/assets/yolo-v9-t-640-license-plates-end2end.onnx"
CORAL_FACE_MODEL_URL="https://github.com/google-coral/test_data/raw/master/ssd_mobilenet_v2_face_quant_postprocess_edgetpu.tflite"
LIBEDGETPU_RELEASE_API="https://api.github.com/repos/feranick/libedgetpu/releases/latest"
LIBRKNNRT_URL="https://github.com/airockchip/rknn-toolkit2/raw/master/rknpu2/runtime/Linux/librknn_api/aarch64/librknnrt.so"

mkdir -p "${DATA_DIR}" "${MODELS}" "${LIB_DIR}"

is_debian() {
    command -v dpkg >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1
}

apt_install() {
    if is_debian && sudo -n true 2>/dev/null; then
        sudo -n apt-get update
        sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    else
        echo "Cannot install packages without a password. Run once:" >&2
        echo "  sudo apt-get install -y $*" >&2
        exit 2
    fi
}

# Installs system packages with the distro's package manager. Arguments are
# Debian package names; other distros get them mapped.
system_install() {
    if is_debian; then
        apt_install "$@"
        return
    fi

    local packages=() package
    for package in "$@"; do
        case "${package}" in
            python3-venv) ;;  # part of the python package outside Debian
            *) packages+=("${package}") ;;
        esac
    done
    (( ${#packages[@]} == 0 )) && return

    if command -v pacman >/dev/null 2>&1; then
        if sudo -n true 2>/dev/null; then
            sudo -n pacman -S --needed --noconfirm "${packages[@]}"
        else
            echo "Cannot install packages without a password. Run once:" >&2
            echo "  sudo pacman -S --needed ${packages[*]}" >&2
            exit 2
        fi
    else
        echo "Install these packages with your package manager: ${packages[*]}" >&2
        exit 2
    fi
}

# Debian architecture name of this machine (amd64, arm64, armhf).
debian_arch() {
    case "$(uname -m)" in
        x86_64) echo amd64 ;;
        aarch64|arm64) echo arm64 ;;
        armv7l|armv6l) echo armhf ;;
        *) uname -m ;;
    esac
}

download() {
    local url="$1" target="$2"
    if [[ -s "${target}" ]]; then
        return
    fi
    curl --fail --location --retry 3 --silent --show-error --output "${target}.part" "${url}"
    mv "${target}.part" "${target}"
}

has_coral() {
    # USB accelerator (before/after firmware load) or PCIe/M.2 (apex driver).
    [[ -e /dev/apex_0 ]] && return 0
    local device
    for device in /sys/bus/usb/devices/*; do
        [[ -f "${device}/idVendor" ]] || continue
        case "$(cat "${device}/idVendor"):$(cat "${device}/idProduct")" in
            1a6e:089a|18d1:9302) return 0 ;;
        esac
    done
    return 1
}

rockchip_platform() {
    local compatible
    # Device tree only exists on ARM boards.
    [[ -r /proc/device-tree/compatible ]] || return 0
    compatible="$(tr '\0' ' ' < /proc/device-tree/compatible || true)"
    for platform in rk3588 rk3576 rk3568 rk3566 rk3562; do
        if [[ "${compatible}" == *"rockchip,${platform}"* ]]; then
            # rk3566 uses the rk3568 NPU target.
            [[ "${platform}" == "rk3566" ]] && platform="rk3568"
            echo "${platform}"
            return
        fi
    done
}

# --- system packages ----------------------------------------------------------

echo "Step: system packages"
missing=()
command -v ffmpeg >/dev/null 2>&1 || missing+=(ffmpeg)
command -v v4l2-ctl >/dev/null 2>&1 || missing+=(v4l-utils)
python3 -c "import venv, ensurepip" >/dev/null 2>&1 || missing+=(python3-venv)
if (( ${#missing[@]} > 0 )); then
    system_install "${missing[@]}"
fi

# --- python environment -------------------------------------------------------

echo "Step: python environment"
if [[ ! -x "${VENV}/bin/python" ]]; then
    python3 -m venv "${VENV}"
fi
"${VENV}/bin/pip" install --quiet --upgrade pip
# onnxruntime is installed by the GPU runtime step below (CPU, CUDA,
# OpenVINO or ROCm variant; they cannot be installed side by side).
"${VENV}/bin/pip" install --quiet numpy opencv-python-headless

# --- GPU runtime ----------------------------------------------------------------

GPU_RUNTIME_FILE="${DATA_DIR}/gpu-runtime"

kernel_gpu_drivers() {
    local node
    for node in /sys/class/drm/renderD*; do
        [[ -e "${node}/device/driver" ]] && basename "$(readlink -f "${node}/device/driver")"
    done | sort -u
}

ort_has_provider() {
    "${VENV}/bin/python" - "$1" <<'EOF'
import sys
import onnxruntime as ort
if hasattr(ort, "preload_dlls"):
    try:
        ort.preload_dlls()
    except Exception:
        pass
sys.exit(0 if sys.argv[1] in ort.get_available_providers() else 1)
EOF
}

# Installs one onnxruntime variant, replacing any other.
install_ort() {
    "${VENV}/bin/pip" uninstall --quiet -y onnxruntime onnxruntime-gpu onnxruntime-openvino onnxruntime-rocm >/dev/null 2>&1 || true
    "${VENV}/bin/pip" install --quiet "$@"
}

# Detection models run on the GPU when the matching onnxruntime works here:
# NVIDIA (CUDA libraries come as pip wheels, ~2.5 GB), Intel (OpenVINO) and
# AMD (ROCm, only with a system ROCm install). Otherwise the CPU build.
setup_gpu_runtime() {
    local drivers machine current
    drivers="$(kernel_gpu_drivers)"
    machine="$(uname -m)"

    # Re-runs (updates) keep a working runtime instead of downloading it again.
    current="$(cat "${GPU_RUNTIME_FILE}" 2>/dev/null || true)"
    case "${current}" in
        cuda) ort_has_provider CUDAExecutionProvider && return 0 ;;
        openvino) ort_has_provider OpenVINOExecutionProvider && return 0 ;;
        rocm) ort_has_provider ROCMExecutionProvider && return 0 ;;
    esac

    if [[ -e /proc/driver/nvidia/version && ( "${machine}" == "x86_64" || "${machine}" == "aarch64" ) ]]; then
        echo "Installing CUDA runtime for the NVIDIA GPU..."
        if install_ort "onnxruntime-gpu[cuda,cudnn]" && ort_has_provider CUDAExecutionProvider; then
            echo cuda > "${GPU_RUNTIME_FILE}"
            return 0
        fi
        echo "CUDA runtime not usable." >&2
    fi

    if grep -qxE 'i915|xe' <<<"${drivers}" && [[ "${machine}" == "x86_64" ]]; then
        echo "Installing OpenVINO runtime for the Intel GPU..."
        # OpenCL/Level Zero compute runtime for the GPU (optional, non-fatal).
        if is_debian; then
            (apt_install intel-opencl-icd) || true
        elif command -v pacman >/dev/null 2>&1; then
            (system_install intel-compute-runtime) || true
        fi
        if install_ort onnxruntime-openvino && ort_has_provider OpenVINOExecutionProvider; then
            echo openvino > "${GPU_RUNTIME_FILE}"
            return 0
        fi
        echo "OpenVINO runtime not usable (no wheel for this Python?)." >&2
    fi

    if grep -qx amdgpu <<<"${drivers}" && [[ -d /opt/rocm && "${machine}" == "x86_64" ]]; then
        echo "Installing ROCm runtime for the AMD GPU..."
        if install_ort onnxruntime-rocm && ort_has_provider ROCMExecutionProvider; then
            echo rocm > "${GPU_RUNTIME_FILE}"
            return 0
        fi
        echo "ROCm runtime not usable." >&2
    fi

    return 1
}

echo "Step: gpu runtime"
if ! (set -euo pipefail; setup_gpu_runtime); then
    rm -f "${GPU_RUNTIME_FILE}"
    install_ort onnxruntime
    echo "No usable GPU runtime, detection runs on the CPU (or Coral/NPU)."
fi

# --- models -------------------------------------------------------------------

echo "Step: models"
download "${FACE_MODEL_URL}" "${MODELS}/face_yunet.onnx"
download "${PLATE_MODEL_URL}" "${MODELS}/plate_640.onnx"
# Superseded by plate_640.onnx.
rm -f "${MODELS}/plate.onnx"

# --- Coral Edge TPU -------------------------------------------------------------

libedgetpu_deb_url() {
    local codename="$1"
    curl -fsSL "${LIBEDGETPU_RELEASE_API}" | "${VENV}/bin/python" -c "
import json, sys
for asset in json.load(sys.stdin)['assets']:
    name = asset['name']
    if name.startswith('libedgetpu1-std_') and name.endswith('.${codename}_$(debian_arch).deb'):
        print(asset['browser_download_url'])
        break
"
}

has_libedgetpu() {
    ldconfig -p 2>/dev/null | grep -q 'libedgetpu\.so\.1' || [[ -e "${LIB_DIR}/libedgetpu.so.1" ]]
}

# The Coral needs a udev rule so the (non-root) bot user can open it. The
# Debian package ships one for the "plugdev" group; elsewhere the group of
# the current user is granted access.
# The Coral needs a udev rule so the (non-root) bot user can open it
# (install_coral_udev.sh; install.sh runs it on new systems).
ensure_coral_udev_rule() {
    if [[ -e /etc/udev/rules.d/60-streambot-edgetpu.rules ]]; then
        return
    fi
    if compgen -G "/etc/udev/rules.d/*edgetpu*" >/dev/null || compgen -G "/usr/lib/udev/rules.d/*edgetpu*" >/dev/null \
        || compgen -G "/lib/udev/rules.d/*edgetpu*" >/dev/null; then
        # Rule from the libedgetpu Debian package (group plugdev).
        if ! id -nG | tr ' ' '\n' | grep -qx plugdev; then
            echo "Add the bot user to the plugdev group to use the Coral: sudo usermod -aG plugdev $(id -un)" >&2
        fi
        return
    fi

    if sudo -n true 2>/dev/null; then
        sudo -n bash "${SCRIPT_DIR}/install_coral_udev.sh" "$(id -un)"
        echo "Replug the Coral if it is not detected."
    else
        echo "The Coral needs a udev rule for access. Run once, then replug the Coral:" >&2
        echo "  sudo bash ${SCRIPT_DIR}/install_coral_udev.sh $(id -un)" >&2
    fi
}

setup_coral() {
    download "${CORAL_FACE_MODEL_URL}" "${MODELS}/face_coral_edgetpu.tflite"

    if ! has_libedgetpu; then
        # Google's Coral apt repository is gone; feranick maintains builds of
        # libedgetpu for current Debian/Ubuntu releases.
        if is_debian; then
            local codename deb_url
            codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
            if [[ "$(. /etc/os-release && echo "${ID:-}")" == "ubuntu" ]]; then
                codename="ubuntu$(. /etc/os-release && echo "${VERSION_ID:-}")"
            fi
            deb_url="$(libedgetpu_deb_url "${codename}")"
            if [[ -z "${deb_url}" ]]; then
                echo "No libedgetpu build for ${codename}/$(debian_arch)." >&2
                return 1
            fi
            download "${deb_url}" "${DATA_DIR}/libedgetpu1-std.deb"
            apt_install "${DATA_DIR}/libedgetpu1-std.deb"
        else
            # Other distros: unpack the library from the newest Debian build
            # into the private lib dir (on the worker's LD_LIBRARY_PATH).
            local deb_url extract
            deb_url="$(libedgetpu_deb_url trixie)"
            [[ -n "${deb_url}" ]] || deb_url="$(libedgetpu_deb_url bookworm)"
            if [[ -z "${deb_url}" ]]; then
                echo "No libedgetpu build for $(debian_arch)." >&2
                return 1
            fi
            download "${deb_url}" "${DATA_DIR}/libedgetpu1-std.deb"
            extract="$(mktemp -d)"
            if command -v bsdtar >/dev/null 2>&1; then
                bsdtar -xf "${DATA_DIR}/libedgetpu1-std.deb" -C "${extract}" 'data.tar.*'
            else
                (cd "${extract}" && ar x "${DATA_DIR}/libedgetpu1-std.deb")
            fi
            tar -xf "${extract}"/data.tar.* -C "${extract}"
            find "${extract}" -name 'libedgetpu.so.1*' -exec cp -P {} "${LIB_DIR}/" \;
            rm -rf "${extract}"
            [[ -e "${LIB_DIR}/libedgetpu.so.1" ]] || { echo "libedgetpu.so.1 not found in the package." >&2; return 1; }
        fi
    fi

    ensure_coral_udev_rule

    "${VENV}/bin/pip" install --quiet ai-edge-litert \
        || { echo "ai-edge-litert is not available for this Python." >&2; return 1; }
}

if has_coral; then
    echo "Step: coral runtime"
    # Optional: without it faces are detected on the CPU.
    if ! (set -euo pipefail; setup_coral); then
        echo "Coral setup failed, faces are detected on the CPU." >&2
    fi
fi

# --- Rockchip NPU ---------------------------------------------------------------

setup_rknn() {
    if ! ldconfig -p 2>/dev/null | grep -q 'librknnrt\.so'; then
        download "${LIBRKNNRT_URL}" "${LIB_DIR}/librknnrt.so"
    fi
    "${VENV}/bin/pip" install --quiet rknn-toolkit-lite2

    if [[ ! -s "${MODELS}/face_yunet.rknn" ]]; then
        echo "Step: converting face model for ${PLATFORM}"
        # The converter is large (pulls in torch); use a throwaway venv.
        local CONVERT_VENV
        CONVERT_VENV="${DATA_DIR}/convert-venv"
        python3 -m venv "${CONVERT_VENV}"
        if "${CONVERT_VENV}/bin/pip" install --quiet rknn-toolkit2 \
            && "${CONVERT_VENV}/bin/python" "${SCRIPT_DIR}/webcam/convert_rknn.py" \
                "${MODELS}/face_yunet.onnx" "${MODELS}/face_yunet.rknn" "${PLATFORM}"; then
            echo "Face model converted for the ${PLATFORM} NPU."
        else
            echo "Face model conversion failed, faces are detected on the CPU." >&2
            rm -f "${MODELS}/face_yunet.rknn"
        fi
        rm -rf "${CONVERT_VENV}"
    fi
}

PLATFORM="$(rockchip_platform)"
if [[ -n "${PLATFORM}" && "$(uname -m)" == "aarch64" ]] && [[ -e /dev/rknpu || -d /sys/module/rknpu ]]; then
    echo "Step: rockchip npu runtime"
    # Optional: without it faces are detected on the CPU.
    if ! (set -euo pipefail; setup_rknn); then
        echo "Rockchip NPU setup failed, faces are detected on the CPU." >&2
    fi
fi

date -u +%Y-%m-%dT%H:%M:%SZ > "${DATA_DIR}/.installed"
echo "Webcam blur installed in ${DATA_DIR}"

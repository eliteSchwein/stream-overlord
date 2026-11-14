#!/usr/bin/env python3
"""
Converts the YuNet face detector (ONNX) to RKNN for the Rockchip NPU.

Runs on the device itself (rknn-toolkit2 ships aarch64 wheels). The model is
converted with a fixed 640x640 input and without quantization (fp16), so no
calibration dataset is needed. Input is BGR uint8 NHWC, 0-255, like YuNet
expects in OpenCV.

Usage: convert_rknn.py <input.onnx> <output.rknn> <platform, e.g. rk3588>
"""

import sys

from rknn.api import RKNN


def main():
    source, target, platform = sys.argv[1:4]

    rknn = RKNN(verbose=False)
    rknn.config(mean_values=[[0, 0, 0]], std_values=[[1, 1, 1]], target_platform=platform)

    if rknn.load_onnx(model=source, inputs=["input"], input_size_list=[[1, 3, 640, 640]]) != 0:
        sys.exit("failed to load the onnx model")
    if rknn.build(do_quantization=False) != 0:
        sys.exit("failed to build the rknn model")
    if rknn.export_rknn(target) != 0:
        sys.exit("failed to export the rknn model")

    rknn.release()


if __name__ == "__main__":
    main()

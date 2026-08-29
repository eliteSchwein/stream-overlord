#!/usr/bin/env bash
set -euo pipefail

TTS_ROOT="${HOME}/.local/share/streambot/tts"
TMP_ROOT="$(mktemp -d)"
STAGE_ROOT="${TMP_ROOT}/stage"
ARCH="$(uname -m)"
PIPER_VERSION="2023.11.14-2"

cleanup() {
    rm -rf "${TMP_ROOT}"
}
trap cleanup EXIT

case "${ARCH}" in
    x86_64|amd64)
        PIPER_ARCH="x86_64"
        ;;
    aarch64|arm64)
        PIPER_ARCH="aarch64"
        ;;
    *)
        echo "Unsupported architecture: ${ARCH}" >&2
        exit 1
        ;;
esac

DOWNLOAD_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_${PIPER_ARCH}.tar.gz"
ARCHIVE="${TMP_ROOT}/piper.tar.gz"

mkdir -p "${STAGE_ROOT}" "${TTS_ROOT}/models"

echo "Downloading Piper (${PIPER_ARCH})..."
curl --fail --location --retry 3 --output "${ARCHIVE}" "${DOWNLOAD_URL}"

echo "Extracting Piper..."
tar -xzf "${ARCHIVE}" -C "${STAGE_ROOT}"

PIPER_STAGE="${STAGE_ROOT}/piper"
if [[ ! -x "${PIPER_STAGE}/piper" ]]; then
    echo "Downloaded archive does not contain piper/piper." >&2
    exit 1
fi

# Replace only the Piper runtime. Keep downloaded voice models on reinstall.
# A disabled TTS setting purges the complete TTS_ROOT in TTShelper.ts.
shopt -s dotglob nullglob
for item in "${TTS_ROOT}"/*; do
    [[ "$(basename "${item}")" == "models" ]] && continue
    rm -rf "${item}"
done

for item in "${PIPER_STAGE}"/*; do
    mv "${item}" "${TTS_ROOT}/"
done
shopt -u dotglob nullglob

chmod +x "${TTS_ROOT}/piper"
echo "TTS installed in ${TTS_ROOT}"

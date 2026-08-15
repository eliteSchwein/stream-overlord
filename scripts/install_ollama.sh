#!/usr/bin/env bash
set -euo pipefail

OLLAMA_ROOT="${HOME}/.local/share/streambot/ollama"
TMP_ROOT="$(mktemp -d)"
STAGE_ROOT="${TMP_ROOT}/stage"
ARCH="$(uname -m)"

cleanup() {
    rm -rf "${TMP_ROOT}"
}
trap cleanup EXIT

case "${ARCH}" in
    x86_64|amd64)
        OLLAMA_ARCH="amd64"
        ;;
    aarch64|arm64)
        OLLAMA_ARCH="arm64"
        ;;
    *)
        echo "Unsupported architecture: ${ARCH}" >&2
        exit 1
        ;;
esac

DOWNLOAD_URL="https://ollama.com/download/ollama-linux-${OLLAMA_ARCH}.tar.zst"
ARCHIVE="${TMP_ROOT}/ollama.tar.zst"

mkdir -p \
    "${OLLAMA_ROOT}" \
    "${OLLAMA_ROOT}/models" \
    "${OLLAMA_ROOT}/home" \
    "${OLLAMA_ROOT}/cache" \
    "${OLLAMA_ROOT}/config" \
    "${OLLAMA_ROOT}/tmp" \
    "${STAGE_ROOT}"

echo "Downloading Ollama (${OLLAMA_ARCH})..."
curl --fail --location --retry 3 --output "${ARCHIVE}" "${DOWNLOAD_URL}"

echo "Extracting Ollama..."
if tar --help 2>/dev/null | grep -q -- '--zstd'; then
    tar --zstd -xf "${ARCHIVE}" -C "${STAGE_ROOT}"
elif command -v unzstd >/dev/null 2>&1; then
    unzstd -c "${ARCHIVE}" | tar -xf - -C "${STAGE_ROOT}"
elif command -v zstd >/dev/null 2>&1; then
    zstd -dc "${ARCHIVE}" | tar -xf - -C "${STAGE_ROOT}"
else
    echo "A tar implementation with zstd support, unzstd, or zstd is required." >&2
    exit 1
fi

if [[ ! -x "${STAGE_ROOT}/bin/ollama" ]]; then
    echo "Downloaded archive does not contain bin/ollama." >&2
    exit 1
fi

# Replace only the Ollama runtime. Models and local state stay in OLLAMA_ROOT.
rm -rf "${OLLAMA_ROOT}/bin" "${OLLAMA_ROOT}/lib"

if [[ -d "${STAGE_ROOT}/bin" ]]; then
    mv "${STAGE_ROOT}/bin" "${OLLAMA_ROOT}/bin"
fi
if [[ -d "${STAGE_ROOT}/lib" ]]; then
    mv "${STAGE_ROOT}/lib" "${OLLAMA_ROOT}/lib"
fi

# Preserve any future top-level runtime files/directories shipped by Ollama.
shopt -s dotglob nullglob
for item in "${STAGE_ROOT}"/*; do
    name="$(basename "${item}")"
    case "${name}" in
        bin|lib|models|home|cache|config|tmp)
            continue
            ;;
    esac
    rm -rf "${OLLAMA_ROOT:?}/${name}"
    mv "${item}" "${OLLAMA_ROOT}/${name}"
done
shopt -u dotglob nullglob

chmod +x "${OLLAMA_ROOT}/bin/ollama"

echo "Ollama installed in ${OLLAMA_ROOT}"

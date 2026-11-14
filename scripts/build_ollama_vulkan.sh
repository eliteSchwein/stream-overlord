#!/usr/bin/env bash
# Builds the ggml Vulkan backend for the installed Ollama runtime.
#
# Ollama only ships lib/ollama/vulkan for amd64. On arm64 (e.g. Raspberry Pi)
# this compiles it from the Ollama source matching the installed version,
# using upstream's own "vulkan" preset, and installs it to lib/ollama/vulkan.
#
# Usage: build_ollama_vulkan.sh [--force]
# Exit codes: 0 = backend present/built or skipped, 1 = build failed,
#             2 = build dependencies missing and cannot be installed.
set -euo pipefail

OLLAMA_ROOT="${OLLAMA_ROOT:-${HOME}/.local/share/streambot/ollama}"
OLLAMA_BIN="${OLLAMA_ROOT}/bin/ollama"
VULKAN_DIR="${OLLAMA_ROOT}/lib/ollama/vulkan"
BUILD_MARKER="${VULKAN_DIR}/.streambot-build-version"
FAILED_MARKER="${OLLAMA_ROOT}/.vulkan-build-failed"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
    FORCE=1
fi

if [[ ! -x "${OLLAMA_BIN}" ]]; then
    echo "Ollama is not installed in ${OLLAMA_ROOT}" >&2
    exit 1
fi

ollama_version() {
    # The last version printed is the client (= installed binary) version.
    OLLAMA_HOST=127.0.0.1:1 "${OLLAMA_BIN}" --version 2>&1 \
        | grep -oE '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?' \
        | tail -n1
}

VERSION="$(ollama_version)"
if [[ -z "${VERSION}" ]]; then
    echo "Could not determine the installed Ollama version." >&2
    exit 1
fi

if [[ -f "${VULKAN_DIR}/libggml-vulkan.so" ]]; then
    if [[ ! -f "${BUILD_MARKER}" || "$(cat "${BUILD_MARKER}")" == "${VERSION}" ]]; then
        echo "Vulkan backend for Ollama ${VERSION} is already installed."
        exit 0
    fi
fi

if [[ "${FORCE}" -eq 0 && -f "${FAILED_MARKER}" && "$(cat "${FAILED_MARKER}")" == "${VERSION}" ]]; then
    echo "Vulkan backend build already failed for Ollama ${VERSION}, skipping (use --force to retry)."
    exit 0
fi

# --- dependencies -----------------------------------------------------------

APT_PACKAGES=(
    build-essential cmake ninja-build git curl ca-certificates
    pkg-config libvulkan-dev glslc spirv-headers
    # runtime: Vulkan loader and Mesa drivers (v3dv for Raspberry Pi, ANV/RADV)
    libvulkan1 mesa-vulkan-drivers
)

missing_deps() {
    local missing=()
    for cmd in cmake ninja git g++ glslc; do
        command -v "${cmd}" >/dev/null 2>&1 || missing+=("${cmd}")
    done
    [[ -f /usr/include/vulkan/vulkan.h ]] || missing+=("vulkan-headers")
    [[ -d /usr/include/spirv ]] || missing+=("spirv-headers")
    printf '%s\n' "${missing[@]}"
}

if [[ -n "$(missing_deps)" ]]; then
    echo "Missing build dependencies: $(missing_deps | tr '\n' ' ')"

    if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        echo "Installing build dependencies..."
        sudo -n apt-get update
        sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y "${APT_PACKAGES[@]}"
    else
        echo "Cannot install them without a password. Run once:" >&2
        echo "  sudo apt-get install -y ${APT_PACKAGES[*]}" >&2
        exit 2
    fi

    if [[ -n "$(missing_deps)" ]]; then
        echo "Still missing: $(missing_deps | tr '\n' ' ')" >&2
        exit 2
    fi
fi

CMAKE_VERSION="$(cmake --version | grep -oE '[0-9]+\.[0-9]+' | head -n1)"
if [[ "$(printf '%s\n' "3.24" "${CMAKE_VERSION}" | sort -V | head -n1)" != "3.24" ]]; then
    echo "CMake >= 3.24 is required (found ${CMAKE_VERSION})." >&2
    exit 2
fi

# --- build ------------------------------------------------------------------

# Build on disk instead of /tmp, which is a small tmpfs on many Pi setups.
mkdir -p "${OLLAMA_ROOT}/tmp"
WORK_DIR="$(mktemp -d "${OLLAMA_ROOT}/tmp/vulkan-build.XXXXXX")"

on_exit() {
    local status=$?
    rm -rf "${WORK_DIR}"
    if [[ ${status} -eq 1 ]]; then
        echo "${VERSION}" > "${FAILED_MARKER}"
        echo "Vulkan backend build failed for Ollama ${VERSION}." >&2
    fi
}
trap on_exit EXIT
trap 'exit 1' ERR

# Compiling ggml-vulkan needs ~1.5 GiB RAM per job.
MEM_MIB="$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)"
JOBS="$(nproc)"
MAX_JOBS=$(( MEM_MIB / 1536 ))
if (( MAX_JOBS < 1 )); then MAX_JOBS=1; fi
if (( JOBS > MAX_JOBS )); then JOBS=${MAX_JOBS}; fi

echo "Downloading Ollama ${VERSION} source..."
curl --fail --location --retry 3 --silent --show-error \
    --output "${WORK_DIR}/source.tar.gz" \
    "https://github.com/ollama/ollama/archive/refs/tags/v${VERSION}.tar.gz"
mkdir -p "${WORK_DIR}/source"
tar -xzf "${WORK_DIR}/source.tar.gz" -C "${WORK_DIR}/source" --strip-components 1

cd "${WORK_DIR}/source"

echo "Configuring Vulkan backend (llama.cpp $(cat LLAMA_CPP_VERSION))..."
CMAKE_GENERATOR=Ninja cmake -S llama/server --preset vulkan

echo "Building Vulkan backend with ${JOBS} job(s), this can take a while..."
cmake --build build/llama-server-vulkan --target ggml-vulkan -- -j "${JOBS}"

LIB="$(find build/llama-server-vulkan -name 'libggml-vulkan.so' -print -quit)"
if [[ -z "${LIB}" ]]; then
    echo "Build finished but libggml-vulkan.so was not found." >&2
    exit 1
fi

# Ollama may have been updated/removed while building.
if [[ ! -x "${OLLAMA_BIN}" || "$(ollama_version)" != "${VERSION}" ]]; then
    echo "Ollama changed during the build, discarding the result."
    exit 0
fi

mkdir -p "${VULKAN_DIR}"
install -m 0755 "$(readlink -f "${LIB}")" "${VULKAN_DIR}/libggml-vulkan.so"
strip --strip-unneeded "${VULKAN_DIR}/libggml-vulkan.so" 2>/dev/null || true
echo "${VERSION}" > "${BUILD_MARKER}"
rm -f "${FAILED_MARKER}"

echo "Vulkan backend for Ollama ${VERSION} installed in ${VULKAN_DIR}"

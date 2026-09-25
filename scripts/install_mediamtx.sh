\
#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo $0" >&2
  exit 1
fi

ARCH="$(dpkg --print-architecture)"
case "${ARCH}" in
  amd64) MTX_ARCH="linux_amd64" ;;
  arm64) MTX_ARCH="linux_arm64v8" ;;
  armhf) MTX_ARCH="linux_armv7" ;;
  *)
    echo "Unsupported Debian architecture: ${ARCH}" >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "[1/6] Installing dependencies..."
apt-get update
apt-get install -y curl ca-certificates tar

echo "[2/6] Resolving latest MediaMTX release..."
LATEST_TAG="$(
  curl -fsSL https://api.github.com/repos/bluenviron/mediamtx/releases/latest \
    | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n1
)"

if [[ -z "${LATEST_TAG}" ]]; then
  echo "Failed to determine latest MediaMTX release." >&2
  exit 1
fi

VERSION="${LATEST_TAG#v}"
ARCHIVE="mediamtx_v${VERSION}_${MTX_ARCH}.tar.gz"
URL="https://github.com/bluenviron/mediamtx/releases/download/${LATEST_TAG}/${ARCHIVE}"

echo "[3/6] Downloading ${ARCHIVE}..."
curl -fL "${URL}" -o "${TMP_DIR}/${ARCHIVE}"

echo "[4/6] Installing MediaMTX..."
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"
install -m 0755 "${TMP_DIR}/mediamtx" /usr/local/bin/mediamtx

install -d -m 0755 /etc/mediamtx
install -m 0644 "$(dirname "$0")/mediamtx.yml" /etc/mediamtx/mediamtx.yml
install -m 0644 "$(dirname "$0")/mediamtx.service" /etc/systemd/system/mediamtx.service

echo "[5/6] Enabling service..."
systemctl daemon-reload
systemctl enable mediamtx.service

echo "[6/6] Starting/restarting MediaMTX..."
systemctl restart mediamtx.service

echo
echo "MediaMTX ${VERSION} installed."
echo
systemctl --no-pager --full status mediamtx.service || true
echo
echo "Listening ports:"
ss -lntup | grep -E ':(8554|8889|8189)\b' || true

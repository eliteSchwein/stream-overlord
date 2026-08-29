#!/usr/bin/env bash
set -euo pipefail

USER_NAME="${SUDO_USER:-$USER}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
USER_GROUP="$(id -gn "$USER_NAME")"

VENV_DIR="$USER_HOME/neopixel-venv"
SCRIPT_PATH="$USER_HOME/stream-overlord/backend/helper/neopixel_cli.py"
WRAPPER="/usr/local/bin/stream-overlord-neopixel"
SERVICE="/etc/systemd/system/stream-overlord-neopixel.service"
SOCKET_DIR="/run/stream-overlord-neopixel"
SOCKET_PATH="$SOCKET_DIR/neopixel.sock"

if [[ -z "$USER_HOME" ]]; then
  echo "ERROR: Could not determine home directory for user: $USER_NAME"
  exit 1
fi

echo "[1/7] Installing OS packages..."
sudo apt update
sudo apt install -y python3-full python3-venv python3-dev build-essential swig

echo "[2/7] Creating/Updating venv at: $VENV_DIR"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

echo "[3/7] Installing Python packages into venv..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install rpi-ws281x adafruit-circuitpython-neopixel lgpio

echo "[4/7] Checking neopixel_cli.py exists..."
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "ERROR: Script not found at: $SCRIPT_PATH"
  echo "Make sure neopixel_cli.py is located there before running this installer."
  exit 1
fi
sudo chmod 0755 "$SCRIPT_PATH" || true

echo "[5/7] Installing unprivileged client wrapper: $WRAPPER"
sudo tee "$WRAPPER" >/dev/null <<EOF_WRAPPER
#!/bin/bash
set -euo pipefail

VENV_PY="$VENV_DIR/bin/python"
SCRIPT="$SCRIPT_PATH"

exec "\$VENV_PY" "\$SCRIPT" --socket "$SOCKET_PATH" "\$@"
EOF_WRAPPER

sudo chmod 0755 "$WRAPPER"
sudo chown root:root "$WRAPPER"

echo "[6/7] Installing root daemon service: $SERVICE"
sudo tee "$SERVICE" >/dev/null <<EOF_SERVICE
[Unit]
Description=Stream Overlord NeoPixel daemon
After=local-fs.target

[Service]
Type=simple
User=root
RuntimeDirectory=stream-overlord-neopixel
RuntimeDirectoryMode=0755
ExecStart=$VENV_DIR/bin/python $SCRIPT_PATH --daemon --socket $SOCKET_PATH --socket-group $USER_GROUP
Restart=on-failure
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF_SERVICE

echo "[7/7] Enabling and restarting NeoPixel daemon..."
sudo systemctl daemon-reload
sudo systemctl enable --now stream-overlord-neopixel.service
sudo systemctl restart stream-overlord-neopixel.service

echo
echo "Done."
echo "No pkexec/polkit is needed for NeoPixel updates anymore."
echo
echo "Service:"
echo "  systemctl status stream-overlord-neopixel.service"
echo
echo "Socket:"
echo "  ls -l $SOCKET_PATH"
echo
echo "Test without sudo/pkexec:"
echo "  $WRAPPER --gpio 17 --count 2 --index 0 --color red"

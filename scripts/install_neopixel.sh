#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="/home/$USER/neopixel-venv"
SCRIPT_PATH="/home/$USER/stream-overlord/backend/helper/neopixel_cli.py"
WRAPPER="/usr/local/bin/stream-overlord-neopixel"

echo "[1/5] Installing OS packages..."
sudo apt update
sudo apt install -y python3-full python3-venv python3-dev build-essential swig

echo "[2/5] Creating/Updating venv at: $VENV_DIR"
python3 -m venv "$VENV_DIR"

echo "[3/5] Installing Python packages into venv..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install rpi-ws281x adafruit-circuitpython-neopixel lgpio

echo "[4/5] Checking neopixel_cli.py exists..."
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "ERROR: Script not found at: $SCRIPT_PATH"
  echo "Make sure neopixel_cli.py is located there before running this installer."
  exit 1
fi
sudo chmod 0755 "$SCRIPT_PATH" || true

echo "[5/5] Installing root wrapper: $WRAPPER"
sudo tee "$WRAPPER" >/dev/null <<EOF
#!/bin/bash
set -euo pipefail

VENV_PY="${VENV_DIR}/bin/python"
SCRIPT="${SCRIPT_PATH}"

exec "\$VENV_PY" "\$SCRIPT" "\$@"
EOF

sudo chmod 0755 "$WRAPPER"
sudo chown root:root "$WRAPPER"

echo "Done."
echo "Next: run ./install_polkit_rules.sh"
echo "Then test:"
echo "  pkexec ${WRAPPER} --gpio 17 --count 2 --index 0 --color red"

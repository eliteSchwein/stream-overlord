#!/bin/bash
set -e

mkdir -p ~/.config/systemd/user/
mkdir -p ~/.config/autostart

cp stream-overlord.service ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable stream-overlord

sudo apt install -y evtest alsa-utils libespeak-ng1 espeak libespeak-dev curl liblgpio-dev build-essential liblgpio1

# music dependencies
sudo apt install -y \
    mpv \
    cava \
    ffmpeg \
    python3 \
    python3-pip \
    git \
    pulseaudio-utils

# yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -o /usr/local/bin/yt-dlp

sudo chmod +x /usr/local/bin/yt-dlp

# Python user-installed CLI PATH
PIP_PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

add_pip_path() {
    local file="$1"

    if [ ! -f "$file" ]; then
        echo "$file not present, skipping"
        return
    fi

    if ! grep -Fxq "$PIP_PATH_LINE" "$file"; then
        {
            echo
            echo "# Python user-installed CLI tools"
            echo "$PIP_PATH_LINE"
        } >> "$file"

        echo "Added Python PATH to $file"
    else
        echo "Python PATH already present in $file"
    fi
}

add_pip_path "$HOME/.bashrc"
add_pip_path "$HOME/.zshrc"

# Make streamrip available for THIS installer run.
# Do not source .zshrc here; Oh My Zsh rejects being loaded from bash.
export PATH="$HOME/.local/bin:$PATH"

# streamrip
python3 -m pip install --user --break-system-packages streamrip

export PATH="$HOME/.local/bin:$PATH"
mkdir -p "$HOME/.local/bin"

if ! command -v streamrip >/dev/null 2>&1; then
    STREAMRIP_BIN="$(python3 -m site --user-base)/bin/streamrip"

    if [ -x "$STREAMRIP_BIN" ]; then
        ln -sf "$STREAMRIP_BIN" "$HOME/.local/bin/streamrip"
    fi
fi

if ! command -v streamrip >/dev/null 2>&1; then
    echo "streamrip installed, but executable was not created."
    echo
    echo "Debug info:"
    python3 -m pip show streamrip || true
    echo "User base: $(python3 -m site --user-base)"
    echo "User scripts:"
    ls -la "$(python3 -m site --user-base)/bin" 2>/dev/null || true
    echo "$HOME/.local/bin:"
    ls -la "$HOME/.local/bin" 2>/dev/null || true
    exit 1
fi

echo "streamrip found at: $(command -v streamrip)"

bash install_neopixel.sh
bash install_polkit.sh
bash migrateNode.sh
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

export PATH="$HOME/.local/bin:$PATH"

if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" || true
fi

if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" || true
fi

# streamrip
python3 -m pip install --user --break-system-packages streamrip

export PATH="$HOME/.local/bin:$PATH"

if ! command -v streamrip >/dev/null 2>&1; then
    echo "streamrip installed, but not found in PATH."
    echo "Expected location: $HOME/.local/bin/streamrip"
    echo "Current PATH: $PATH"
    exit 1
fi

bash install_neopixel.sh
bash install_polkit.sh
bash migrateNode.sh
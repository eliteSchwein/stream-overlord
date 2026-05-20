#!/bin/bash

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

# streamrip
python3 -m pip install --break-system-packages streamrip

bash install_neopixel.sh

bash install_polkit.sh

bash migrateNode.sh


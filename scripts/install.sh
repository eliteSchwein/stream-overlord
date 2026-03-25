#!/bin/bash

mkdir -p ~/.config/systemd/user/
mkdir -p ~/.config/autostart

cp stream-overlord.service ~/.config/systemd/user/
cp touch-autostart.desktop ~/.config/autostart/

rm -rf ~/.config/autostart/firefox-commander.desktop

systemctl --user daemon-reload
systemctl --user enable stream-overlord

sudo apt install -y evtest alsa-utils libespeak-ng1 espeak libespeak-dev curl liblgpio-dev build-essential liblgpio1

bash install_neopixel.sh

bash install_polkit.sh

bash migrateNode.sh

sudo apt remove stream-overlord-touch

sudo apt install ../touch/src-tauri/target/aarch64-unknown-linux-gnu/release/bundle/deb/stream-overlord-touch_0.1.0_arm64.deb
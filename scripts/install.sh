#!/bin/bash

mkdir -p ~/.config/systemd/user/
mkdir -p ~/.config/autostart

cp stream-overlord.service ~/.config/systemd/user/
cp firefox-commander.desktop ~/.config/autostart/

systemctl --user daemon-reload
systemctl --user enable stream-overlord

sudo apt install -y evtest alsa-utils libespeak-ng1 espeak libespeak-dev curl liblgpio-dev build-essential

bash install_polkit.sh

bash migrateNode.sh
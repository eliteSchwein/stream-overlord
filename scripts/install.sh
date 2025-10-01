#!/bin/bash

mkdir -p ~/.config/systemd/user/
mkdir -p ~/.config/autostart/

cp stream-overlord.service ~/.config/systemd/user/
cp firefox-commander.desktop ~/.config/autostart/

sudo apt install -y evtest alsa-utils libespeak-ng1 espeak libespeak-dev

bash migrateNode.sh

bash install_polkit.sh
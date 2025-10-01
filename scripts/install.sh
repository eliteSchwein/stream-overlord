#!/bin/bash

mkdir -p ~/.config/systemd/user/

cp stream-overlord.service ~/.config/systemd/user/
cp firefox-commander.service ~/.config/systemd/user/

sudo apt install -y evtest alsa-utils libespeak-ng1 espeak libespeak-dev

bash migrateNode.sh

bash install_polkit.sh
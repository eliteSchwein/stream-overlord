#!/usr/bin/env bash
set -euo pipefail

USER_NAME="$USER"
WRAPPER="/usr/local/bin/stream-overlord-neopixel"
POLKIT_RULE="/etc/polkit-1/rules.d/49-stream-overlord-power.rules"

echo "[1/2] Writing polkit rule: $POLKIT_RULE"
sudo tee "$POLKIT_RULE" >/dev/null <<EOF
/**
 * Stream Overlord polkit rules:
 *  - Allow user "${USER_NAME}" to reboot/power off without password (systemd-logind)
 *  - Allow user "${USER_NAME}" to run ONE specific root helper via pkexec:
 *      ${WRAPPER}
 */

polkit.addRule(function(action, subject) {

  if (subject.user !== "${USER_NAME}") {
    return;
  }

  // 1) login1 power actions
  const allowLogin1 = [
    "org.freedesktop.login1.reboot",
    "org.freedesktop.login1.reboot-multiple-sessions",
    "org.freedesktop.login1.power-off",
    "org.freedesktop.login1.power-off-multiple-sessions"
  ];

  if (allowLogin1.indexOf(action.id) !== -1) {
    return polkit.Result.YES;
  }

  // 2) pkexec allowlist: only permit running our fixed wrapper as root
  if (action.id === "org.freedesktop.policykit.exec") {
    var program = action.lookup("program");
    if (program === "${WRAPPER}") {
      return polkit.Result.YES;
    }
  }
});
EOF

echo "[2/2] Restarting polkit..."
sudo systemctl restart polkit || true

echo "Done."
echo "Test:"
echo "  pkexec ${WRAPPER} --gpio 17 --count 2 --index 0 --color red"

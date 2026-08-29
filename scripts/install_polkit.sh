#!/usr/bin/env bash
set -euo pipefail

USER_NAME="$USER"
WRAPPER="/usr/local/bin/stream-overlord-neopixel"
POLKIT_RULE="/etc/polkit-1/rules.d/49-stream-overlord-power.rules"
RSYSLOG_RULE="/etc/rsyslog.d/30-hide-neopixel-pkexec.conf"

echo "[1/4] Writing polkit rule: $POLKIT_RULE"
sudo tee "$POLKIT_RULE" >/dev/null <<EOF_POLKIT
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
EOF_POLKIT

echo "[2/4] Writing rsyslog filter: $RSYSLOG_RULE"
sudo tee "$RSYSLOG_RULE" >/dev/null <<EOF_RSYSLOG
if (\$programname == "pkexec" and \$msg contains "${WRAPPER}") then stop
EOF_RSYSLOG

echo "[3/4] Restarting polkit..."
sudo systemctl restart polkit || true

echo "[4/4] Restarting rsyslog..."
sudo systemctl restart rsyslog

echo "Done."
echo "Test:"
echo "  pkexec ${WRAPPER} --gpio 17 --count 2 --index 0 --color red"

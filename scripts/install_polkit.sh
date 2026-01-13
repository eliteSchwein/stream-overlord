#!/bin/bash
sudo tee /etc/polkit-1/rules.d/49-stream-overlord-power.rules >/dev/null <<'EOF'
/**
 * Allow a specific user to reboot/power off without a password.
 * Applies to systemd-logind (org.freedesktop.login1) actions.
 */
polkit.addRule(function(action, subject) {
  // IDs we want to allow
  const allow = [
    "org.freedesktop.login1.reboot",
    "org.freedesktop.login1.reboot-multiple-sessions",
    "org.freedesktop.login1.power-off",
    "org.freedesktop.login1.power-off-multiple-sessions"
  ];

  if (allow.indexOf(action.id) !== -1 && subject.user === "YOUR_USER") {
    return polkit.Result.YES;
  }
});
EOF

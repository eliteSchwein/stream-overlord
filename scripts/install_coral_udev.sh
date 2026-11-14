#!/usr/bin/env bash
# Grants a (non-root) user access to Coral Edge TPUs, so the webcam privacy
# blur can use them:
#  - USB accelerators: udev rule for both USB ids (before and after the
#    firmware load the device re-enumerates as 18d1:9302)
#  - PCIe/M.2 modules (gasket/apex driver): membership in the "apex" group
#
# Usage: sudo bash install_coral_udev.sh [user]   (default: $SUDO_USER)
set -euo pipefail

TARGET_USER="${1:-${SUDO_USER:-}}"
RULES_FILE="/etc/udev/rules.d/60-streambot-edgetpu.rules"

if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run as root: sudo bash $0 ${TARGET_USER:-<user>}" >&2
    exit 1
fi
if [[ -z "${TARGET_USER}" ]] || ! id "${TARGET_USER}" >/dev/null 2>&1; then
    echo "Unknown user: ${TARGET_USER:-<none>} (usage: sudo bash $0 <user>)" >&2
    exit 1
fi

GROUP="$(id -gn "${TARGET_USER}")"

cat > "${RULES_FILE}" <<EOF
# Managed by streambot (install_coral_udev.sh): Coral USB Accelerator access.
SUBSYSTEM=="usb",ATTRS{idVendor}=="1a6e",ATTRS{idProduct}=="089a",GROUP="${GROUP}",MODE="0660"
SUBSYSTEM=="usb",ATTRS{idVendor}=="18d1",ATTRS{idProduct}=="9302",GROUP="${GROUP}",MODE="0660"
EOF
chmod 0644 "${RULES_FILE}"
echo "Wrote ${RULES_FILE} (group ${GROUP})"

if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules
    # Apply to Corals that are already plugged in.
    udevadm trigger --subsystem-match=usb --attr-match=idVendor=1a6e || true
    udevadm trigger --subsystem-match=usb --attr-match=idVendor=18d1 || true
fi

# PCIe/M.2 Corals: the gasket driver creates /dev/apex_N for group "apex".
if getent group apex >/dev/null 2>&1; then
    if ! id -nG "${TARGET_USER}" | tr ' ' '\n' | grep -qx apex; then
        usermod -aG apex "${TARGET_USER}"
        echo "Added ${TARGET_USER} to the apex group (takes effect after the next login/service restart)."
    fi
fi

echo "Coral access configured for ${TARGET_USER}."

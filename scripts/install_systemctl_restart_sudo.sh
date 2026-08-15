#!/usr/bin/env bash
set -euo pipefail

USER_NAME="${SUDO_USER:-$USER}"
SUDOERS_FILE="/etc/sudoers.d/stream-overlord-systemctl-restart"
SYSTEMCTL_BIN="$(command -v systemctl)"

if [[ -z "${SYSTEMCTL_BIN}" ]]; then
    echo "systemctl not found"
    exit 1
fi

if [[ "$#" -eq 0 ]]; then
    SERVICES=(
        "streambottouch"
    )
else
    SERVICES=("$@")
fi

normalize_service() {
    local service="$1"

    service="${service%.service}"

    if [[ ! "$service" =~ ^[A-Za-z0-9_.@:-]+$ ]]; then
        echo "Invalid service name: $1" >&2
        exit 1
    fi

    printf '%s.service' "$service"
}

echo "Installing passwordless systemctl restart rules for user: ${USER_NAME}"
echo "Sudoers file: ${SUDOERS_FILE}"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

{
    echo "# Managed by install_systemctl_restart_sudo.sh"
    echo "# Allows ${USER_NAME} to restart only the explicitly listed services."
    echo

    for service in "${SERVICES[@]}"; do
        normalized="$(normalize_service "$service")"

        echo "${USER_NAME} ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} restart ${normalized}"
        echo "${USER_NAME} ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} restart ${normalized%.service}"
    done
} > "$TMP_FILE"

if ! sudo visudo -cf "$TMP_FILE"; then
    echo "Generated sudoers configuration is invalid."
    exit 1
fi

sudo install \
    -o root \
    -g root \
    -m 0440 \
    "$TMP_FILE" \
    "$SUDOERS_FILE"

echo
echo "Installed:"
sudo cat "$SUDOERS_FILE"

echo
echo "Test commands:"

for service in "${SERVICES[@]}"; do
    normalized="$(normalize_service "$service")"
    echo "  sudo -n ${SYSTEMCTL_BIN} restart ${normalized}"
done

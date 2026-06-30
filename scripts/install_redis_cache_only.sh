#!/usr/bin/env bash
set -euo pipefail

REDIS_CONF="/etc/redis/redis.conf"

echo "[1/4] Disabling Redis RDB snapshots..."
sudo sed -i \
  -e 's/^save .*/# save disabled by streambot setup/' \
  "$REDIS_CONF"

if ! grep -q '^save ""' "$REDIS_CONF"; then
  echo 'save ""' | sudo tee -a "$REDIS_CONF" >/dev/null
fi

echo "[2/4] Disabling Redis AOF persistence..."
if grep -q '^appendonly ' "$REDIS_CONF"; then
  sudo sed -i 's/^appendonly .*/appendonly no/' "$REDIS_CONF"
else
  echo 'appendonly no' | sudo tee -a "$REDIS_CONF" >/dev/null
fi

echo "[3/4] Applying live Redis settings..."
redis-cli CONFIG SET save ""
redis-cli CONFIG SET appendonly no

echo "[4/4] Restarting Redis..."
sudo systemctl restart redis-server

echo "Done."
echo
echo "Verify:"
echo "  redis-cli CONFIG GET save"
echo "  redis-cli CONFIG GET appendonly"
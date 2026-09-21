#!/bin/sh
set -eu

service_name="${1:?systemd service name is required}"
marker="${DFP_BRIDGE_LIVENESS_FILE:?DFP_BRIDGE_LIVENESS_FILE is required}"
max_age="${DFP_BRIDGE_WATCHDOG_MAX_AGE_SECONDS:-30}"

case "$max_age" in
  ''|*[!0-9]*) echo "invalid watchdog max age" >&2; exit 64 ;;
esac

restart_service() {
  reason="$1"
  logger -t dfp-runtime-bridge-watchdog "$reason; restarting $service_name"

  if systemctl try-restart "$service_name"; then
    logger -t dfp-runtime-bridge-watchdog "restart completed for $service_name"
    exit 0
  fi

  logger -t dfp-runtime-bridge-watchdog "restart failed for $service_name"
  exit 1
}

if ! systemctl is-active --quiet "$service_name"; then
  exit 0
fi

now_seconds="$(date +%s)"
if [ ! -f "$marker" ]; then
  restart_service "marker missing"
fi

marker_seconds="$(stat -c %Y "$marker")"
age_seconds="$((now_seconds - marker_seconds))"
if [ "$age_seconds" -gt "$max_age" ]; then
  restart_service "marker stale (${age_seconds}s > ${max_age}s)"
fi

exit 0

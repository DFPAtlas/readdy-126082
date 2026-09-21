#!/bin/sh
set -eu

service_name="${1:?systemd service name is required}"
marker="${DFP_BRIDGE_LIVENESS_FILE:?DFP_BRIDGE_LIVENESS_FILE is required}"
max_age="${DFP_BRIDGE_WATCHDOG_MAX_AGE_SECONDS:-30}"

case "$max_age" in
  ''|*[!0-9]*) echo "invalid watchdog max age" >&2; exit 64 ;;
esac

if ! systemctl is-active --quiet "$service_name"; then
  exit 0
fi

now_seconds="$(date +%s)"
if [ ! -f "$marker" ]; then
  logger -t dfp-runtime-bridge-watchdog "marker missing; restarting $service_name"
  systemctl try-restart "$service_name"
  exit 1
fi

marker_seconds="$(stat -c %Y "$marker")"
age_seconds="$((now_seconds - marker_seconds))"
if [ "$age_seconds" -gt "$max_age" ]; then
  logger -t dfp-runtime-bridge-watchdog "marker stale (${age_seconds}s > ${max_age}s); restarting $service_name"
  systemctl try-restart "$service_name"
  exit 1
fi

exit 0

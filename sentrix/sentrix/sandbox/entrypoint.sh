#!/usr/bin/env bash
set -euo pipefail

# Sentrix single-phase entrypoint: start gateway + log collector, trap SIGTERM, wait -n.
# Channel login runs from the host after gateway is healthy.

OPENCLAW_RAW_STREAM_PATH="${OPENCLAW_RAW_STREAM_PATH:-/data/raw-stream.jsonl}"
SENTRIX_PORT="${SENTRIX_PORT:-18789}"

mkdir -p /data/agent_logs "$(dirname "$OPENCLAW_RAW_STREAM_PATH")"

OPENCLAW_PID=""
COLLECTOR_PID=""

cleanup() {
    echo "[sentrix] shutting down..." >&2
    [ -n "$OPENCLAW_PID" ]   && kill -TERM "$OPENCLAW_PID"   2>/dev/null || true
    [ -n "$COLLECTOR_PID" ]  && kill -TERM "$COLLECTOR_PID"  2>/dev/null || true
    wait "$COLLECTOR_PID" 2>/dev/null || true
    wait "$OPENCLAW_PID"  2>/dev/null || true
    echo "[sentrix] shutdown complete." >&2
}

trap cleanup SIGTERM SIGINT

# Debug: confirm env is available (redacted)
if [ -n "${OPENCLAW_DEFAULT_MODEL:-}" ]; then
  echo "[sentrix] OPENCLAW_DEFAULT_MODEL=${OPENCLAW_DEFAULT_MODEL}" >&2
fi
for v in OPENAI_API_KEY ANTHROPIC_API_KEY MINIMAX_API_KEY MOONSHOT_API_KEY GEMINI_API_KEY; do
  if [ -n "${!v:-}" ]; then
    echo "[sentrix] ${v} is set (len=${#!v})" >&2
  fi
done

# Must run before gateway so auth-profiles.json and openclaw.json are ready
if ! /opt/sentrix/init_auth.py; then
  echo "[sentrix] init_auth.py failed (check env and paths above)" >&2
  exit 1
fi

openclaw gateway run \
    --raw-stream \
    --raw-stream-path "$OPENCLAW_RAW_STREAM_PATH" \
    --port "$SENTRIX_PORT" &
OPENCLAW_PID=$!

python3 /opt/sentrix/collect_logs.py &
COLLECTOR_PID=$!

echo "[sentrix] openclaw pid=$OPENCLAW_PID  collector pid=$COLLECTOR_PID" >&2

wait -n "$OPENCLAW_PID" "$COLLECTOR_PID"
EXIT_CODE=$?

echo "[sentrix] a child process exited ($EXIT_CODE), tearing down..." >&2
cleanup
exit "$EXIT_CODE"

#!/usr/bin/env python3
"""In-sandbox JSONL tailer that writes rotating, timestamped JSON files.

Reads /data/raw-stream.jsonl line-by-line and streams parsed objects into
JSON array files under /data/agent_logs/, rotating every SENTRIX_ROTATE_MINS
minutes (default 10).

Designed for robustness:
  - Partial-line safe: buffers incomplete lines until \\n arrives.
  - Seek-free JSON output: uses comma-before-item pattern.
  - Constant memory: each object is flushed to disk immediately.
  - Clean shutdown: SIGTERM closes the active file with valid JSON.
"""

from __future__ import annotations

import json
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

RAW_STREAM = os.environ.get("OPENCLAW_RAW_STREAM_PATH", "/data/raw-stream.jsonl")
LOG_DIR = Path(os.environ.get("SENTRIX_LOG_DIR", "/data/agent_logs"))
ROTATE_SECS = int(os.environ.get("SENTRIX_ROTATE_MINS", "10")) * 60
POLL_INTERVAL = 0.25  # seconds between readline retries at EOF

_shutdown = False


def _on_sigterm(_signum: int, _frame: object) -> None:
    global _shutdown
    _shutdown = True


signal.signal(signal.SIGTERM, _on_sigterm)
signal.signal(signal.SIGINT, _on_sigterm)


class RotatingWriter:
    """Streams JSON objects into a timestamped file, rotating on interval."""

    def __init__(self, log_dir: Path, rotate_secs: int) -> None:
        self._log_dir = log_dir
        self._rotate_secs = rotate_secs
        self._fp: object = None
        self._is_first_item = True
        self._rotation_start = 0.0

    def _open_new_file(self) -> None:
        self._close()
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        path = self._log_dir / f"{ts}.json"
        self._fp = open(path, "w", encoding="utf-8")
        self._fp.write("[\n")
        self._is_first_item = True
        self._rotation_start = time.monotonic()

    def _close(self) -> None:
        if self._fp is not None:
            # Remove trailing comma so the array is valid JSON (we write "  {obj},\n" per line)
            if not self._is_first_item:
                pos = self._fp.tell()
                self._fp.seek(max(0, pos - 2))
                self._fp.write("\n]\n")
            else:
                self._fp.write("]\n")
            self._fp.close()
            self._fp = None

    def _needs_rotation(self) -> bool:
        return time.monotonic() - self._rotation_start >= self._rotate_secs

    def write_entry(self, obj: dict) -> None:
        if self._fp is None or self._needs_rotation():
            self._open_new_file()

        serialized = json.dumps(obj, ensure_ascii=False)
        # One object per line with trailing comma; _close() strips last comma for valid JSON
        self._fp.write(f"  {serialized},\n")
        self._is_first_item = False
        self._fp.flush()

    def shutdown(self) -> None:
        self._close()


def _wait_for_file(path: str, poll: float = 1.0) -> None:
    """Block until the raw-stream file exists or shutdown is requested."""
    while not os.path.exists(path):
        if _shutdown:
            sys.exit(0)
        time.sleep(poll)


def main() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    _wait_for_file(RAW_STREAM)

    writer = RotatingWriter(LOG_DIR, ROTATE_SECS)
    fragment = ""

    try:
        with open(RAW_STREAM, "r", encoding="utf-8") as f:
            while not _shutdown:
                raw = f.readline()

                if not raw:
                    # EOF – OpenClaw hasn't written more yet
                    time.sleep(POLL_INTERVAL)
                    continue

                if not raw.endswith("\n"):
                    # Partial line: buffer the fragment and retry
                    fragment += raw
                    time.sleep(POLL_INTERVAL)
                    continue

                line = fragment + raw
                fragment = ""

                stripped = line.strip()
                if not stripped:
                    continue

                try:
                    obj = json.loads(stripped)
                except json.JSONDecodeError:
                    print(f"[sentrix] malformed JSONL line, skipping: {stripped[:120]}", file=sys.stderr)
                    continue

                writer.write_entry(obj)
    finally:
        # Drain any remaining fragment (best effort on unclean shutdown)
        if fragment.strip():
            try:
                obj = json.loads(fragment.strip())
                writer.write_entry(obj)
            except json.JSONDecodeError:
                pass
        writer.shutdown()


if __name__ == "__main__":
    main()

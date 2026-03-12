"""Host-side log sync: pulls log files from the sandbox.

Closed files (past rotation window) are synced once and tracked.
The currently-active rotation file is copied in-sandbox to a temp path
(/tmp/sync_active.json), then that snapshot is pulled so the patrol gets
near real-time access without reading a file that is being written.
Tracks already-synced filenames to avoid redundant downloads.
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from opensandbox import Sandbox

SYNC_STATE_FILE = ".sentrix_sync_state"
_TS_PATTERN = re.compile(r"^(\d{8}T\d{6})\.json$")


def _parse_file_timestamp(filename: str) -> datetime | None:
    """Extract the UTC datetime from a log filename like 20260309T141000.json."""
    m = _TS_PATTERN.match(filename)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _load_synced_set(log_dir: Path) -> set[str]:
    state_path = log_dir / SYNC_STATE_FILE
    if state_path.exists():
        try:
            return set(json.loads(state_path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, TypeError):
            pass
    return set()


def _save_synced_set(log_dir: Path, synced: set[str]) -> None:
    state_path = log_dir / SYNC_STATE_FILE
    state_path.write_text(json.dumps(sorted(synced)), encoding="utf-8")


def _fix_incomplete_json(content: str) -> str:
    """If content is an incomplete JSON array (active file), close it for valid JSON."""
    s = content.rstrip()
    if not s.endswith("]"):
        # Remove trailing comma and newline after last object, then close array
        if s.endswith(","):
            s = s[:-1].rstrip()
        s = s + "\n]\n"
    return s


async def sync_once(
    sandbox: Sandbox,
    log_dir: Path,
    rotate_mins: int,
    *,
    force_all: bool = False,
) -> list[str]:
    """Pull log files from the sandbox. Closed files synced once; active file synced every cycle (with JSON fixup)."""
    sandbox_log_dir = "/data/agent_logs"

    result = await sandbox.commands.run(f"ls -1 {sandbox_log_dir} 2>/dev/null || true")
    remote_files = [
        f.strip() for f in result.logs.stdout[0].text.splitlines() if f.strip()
    ] if result.logs.stdout else []

    synced = _load_synced_set(log_dir)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=rotate_mins)
    newly_synced: list[str] = []

    for filename in remote_files:
        remote_path = f"{sandbox_log_dir}/{filename}"
        ts = _parse_file_timestamp(filename)
        is_active = ts is not None and ts > cutoff

        if is_active and not force_all:
            # Active file: copy to temp in sandbox (snapshot at copy time), then pull temp file.
            # Avoids reading a file while it is being written; log_reader can parse valid JSON from it.
            sandbox_tmp = "/tmp/sync_active.json"
            await sandbox.commands.run(f"cp {remote_path} {sandbox_tmp} 2>/dev/null || true")
            try:
                content = await sandbox.files.read_file(sandbox_tmp)
            except Exception:
                content = "[]"
            content = _fix_incomplete_json(content)
            local_path = log_dir / filename
            local_path.write_text(content, encoding="utf-8")
            # Don't append to newly_synced so we don't print "synced X" every poll
            continue

        if filename in synced:
            continue

        # Closed file: sync once and add to synced
        content = await sandbox.files.read_file(remote_path)
        content = _fix_incomplete_json(content)
        local_path = log_dir / filename
        local_path.write_text(content, encoding="utf-8")

        synced.add(filename)
        newly_synced.append(filename)

    _save_synced_set(log_dir, synced)
    return newly_synced


async def sync_once_with_retry(
    sandbox: Sandbox,
    log_dir: Path,
    rotate_mins: int,
    *,
    force_all: bool = False,
    max_retries: int = 3,
    base_delay: float = 2.0,
) -> list[str]:
    """Wrapper around sync_once with exponential backoff on connection errors."""
    for attempt in range(max_retries):
        try:
            return await sync_once(sandbox, log_dir, rotate_mins, force_all=force_all)
        except Exception as exc:
            is_connect_error = "ConnectError" in type(exc).__name__ or "connect" in str(exc).lower()
            if not is_connect_error or attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"[sentrix] sync connection failed (attempt {attempt + 1}/{max_retries}), retrying in {delay:.0f}s...")
            await asyncio.sleep(delay)
    return []


async def run_sync_loop(
    sandbox: Sandbox,
    log_dir: Path,
    rotate_mins: int,
    *,
    poll_secs: float = 5.0,
    stop_event: asyncio.Event | None = None,
) -> None:
    """Periodically sync log files until stop_event is set.
    
    Active files are synced every cycle for near real-time updates.
    Closed files are synced once and tracked.
    """
    # Brief startup delay: let entrypoint.sh + execd stabilize
    await asyncio.sleep(5)

    cycle_count = 0
    while True:
        if stop_event and stop_event.is_set():
            break
        try:
            # Sync - this updates active files every cycle
            pulled = await sync_once_with_retry(sandbox, log_dir, rotate_mins)
            if pulled:
                for f in pulled:
                    print(f"[sentrix] synced {f}")
            cycle_count += 1
            # Log periodic status (every ~30 seconds)
            if cycle_count % 6 == 0:
                print(f"[sentrix] sync cycle {cycle_count} (active files updated)")
        except Exception as exc:
            print(f"[sentrix] sync error: {exc}")

        if stop_event:
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=poll_secs)
                break
            except asyncio.TimeoutError:
                pass
        else:
            await asyncio.sleep(poll_secs)


async def final_sync(sandbox: Sandbox, log_dir: Path, rotate_mins: int) -> list[str]:
    """Final sync after shutdown: pull everything including the active file."""
    await asyncio.sleep(2)  # brief grace period for collector's SIGTERM flush
    return await sync_once_with_retry(sandbox, log_dir, rotate_mins, force_all=True)

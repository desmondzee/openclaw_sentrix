"""Log reader: scan agent_logs, parse JSON arrays, yield normalised turns.

Option C for user context: on first event per runId, extract messages array
from request payload (if present); hold until assistant_message_end for that
runId, then attach to turn. Tracks last-seen position for incremental reads.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

# Pattern for log filenames: YYYYMMDDTHHMMSS.json
_TS_FILENAME = re.compile(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.json$")


def _filename_to_epoch_ms(name: str) -> int | None:
    """Parse YYYYMMDDTHHMMSS.json to epoch milliseconds (UTC). Returns None if not parseable."""
    m = _TS_FILENAME.match(name)
    if not m:
        return None
    y, mo, d, h, mi, s = (int(m.group(i)) for i in range(1, 7))
    try:
        dt = datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except (ValueError, OverflowError):
        return None


def _log_files_sorted(log_dir: Path, min_ts: int = 0) -> list[Path]:
    """Return *.json files in log_dir sorted by name. If min_ts > 0, only include files whose filename timestamp (YYYYMMDDTHHMMSS) is >= min_ts (session start), so we don't read logs from previous sessions."""
    if not log_dir.exists():
        return []
    paths = sorted(log_dir.glob("*.json"), key=lambda p: p.name)
    if min_ts <= 0:
        return paths
    # Only include timestamped log files (YYYYMMDDTHHMMSS.json) from this session (filename >= min_ts).
    out = []
    for p in paths:
        ts_ms = _filename_to_epoch_ms(p.name)
        if ts_ms is not None and ts_ms >= min_ts:
            out.append(p)
    return out


def _extract_messages_from_event(ev: dict[str, Any]) -> list[dict] | None:
    """Extract messages array from first event of a runId (Option C)."""
    # Request payload might be at top level or under body/payload/request
    for key in ("messages", "body", "payload", "request"):
        if key not in ev:
            continue
        val = ev[key]
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
        if isinstance(val, dict) and "messages" in val:
            m = val["messages"]
            if isinstance(m, list):
                return m
    return None


def normalise_turn(
    run_id: str,
    ts: int,
    raw_text: str = "",
    raw_thinking: str = "",
    user_messages: list[dict] | None = None,
    event_type: str = "assistant_message_end",
    source_file: str = "",
) -> dict[str, Any]:
    """Build a normalised turn dict for patrol consumption."""
    turn: dict[str, Any] = {
        "run_id": run_id,
        "ts": ts,
        "runId_ts": f"{run_id}_{ts}",
        "role": "assistant",
        "text": raw_text or "",
        "thinking": raw_thinking or "",
        "event_type": event_type,
        "source_file": source_file,
    }
    if user_messages:
        turn["user_messages"] = user_messages
    return turn


def iter_turns(
    log_dir: Path,
    *,
    after_run_id_ts: set[str] | None = None,
    min_ts: int = 0,
) -> Iterator[dict[str, Any]]:
    """Yield normalised turns from all JSON log files in log_dir.

    Option C: for each runId, the first event may contain a messages array
    (request payload); we hold it and attach to the turn when we see
    assistant_message_end for that runId.

    after_run_id_ts: if provided, only yield turns whose runId_ts is not
    in this set (incremental read).
    """
    seen_run_id_ts = after_run_id_ts or set()
    for path in _log_files_sorted(log_dir, min_ts):
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError:
            continue
        # Fix incomplete JSON (active file may lack closing ])
        s = raw.rstrip()
        if not s.endswith("]"):
            if s.endswith(","):
                s = s[:-1].rstrip()
            s = s + "\n]"
        try:
            entries = json.loads(s)
        except json.JSONDecodeError:
            continue
        if not isinstance(entries, list):
            continue

        # Per-runId: first event may have user messages; buffer until message_end
        runid_user_messages: dict[str, list[dict]] = {}
        runid_first_ts: dict[str, int] = {}

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            run_id = entry.get("runId") or entry.get("run_id") or ""
            ts = entry.get("ts") or 0
            event = entry.get("event") or ""

            if run_id and run_id not in runid_user_messages:
                msgs = _extract_messages_from_event(entry)
                if msgs is not None:
                    runid_user_messages[run_id] = msgs
                runid_first_ts[run_id] = ts

            if event == "assistant_message_end":
                if ts < min_ts:
                    continue
                raw_text = entry.get("rawText") or entry.get("raw_text") or ""
                raw_thinking = entry.get("rawThinking") or entry.get("raw_thinking") or ""
                run_id_ts = f"{run_id}_{ts}"
                if run_id_ts in seen_run_id_ts:
                    continue
                seen_run_id_ts.add(run_id_ts)
                user_messages = runid_user_messages.get(run_id)
                turn = normalise_turn(
                    run_id=run_id,
                    ts=ts,
                    raw_text=raw_text,
                    raw_thinking=raw_thinking,
                    user_messages=user_messages,
                    event_type=event,
                    source_file=path.name,
                )
                turn["runId_ts"] = run_id_ts
                yield turn


def load_turns_from_log_dir(
    log_dir: Path,
    *,
    after_run_id_ts: set[str] | None = None,
    min_ts: int = 0,
) -> list[dict[str, Any]]:
    """Load all normalised turns from log_dir (optionally after given runId_ts set)."""
    return list(iter_turns(log_dir, after_run_id_ts=after_run_id_ts, min_ts=min_ts))


def sorted_log_filenames(log_dir: Path) -> list[str]:
    """Return sorted list of log filenames (*.json in log_dir root, timestamp-like names)."""
    paths = _log_files_sorted(log_dir)
    return [p.name for p in paths]


def load_turns_for_source_files(
    log_dir: Path,
    source_files_ordered: list[str],
) -> list[dict[str, Any]]:
    """Load turns from log_dir for the given source files (order preserved), sorted by file order then ts."""
    all_turns = load_turns_from_log_dir(log_dir)
    file_set = set(source_files_ordered)
    by_file: dict[str, list[dict]] = {f: [] for f in source_files_ordered}
    for t in all_turns:
        sf = t.get("source_file") or ""
        if sf in by_file:
            by_file[sf].append(t)
    out: list[dict[str, Any]] = []
    for f in source_files_ordered:
        turns = by_file.get(f, [])
        turns.sort(key=lambda x: (x.get("ts") or 0, x.get("runId_ts") or ""))
        out.extend(turns)
    return out

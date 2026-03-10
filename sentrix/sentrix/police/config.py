"""Police / LeadInvestigator configuration: API keys, model, paths."""

from __future__ import annotations

import os
from pathlib import Path


def police_db_path(log_dir: Path) -> Path:
    """Path to police SQLite DB (agent_logs/police.db)."""
    return Path(log_dir) / "police.db"


def reports_dir(log_dir: Path) -> Path:
    """Path to case report JSONs (agent_logs/reports/)."""
    return Path(log_dir) / "reports"


# API keys: reuse env (same as patrol)
POLICE_OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "") or os.environ.get(
    "POLICE_OPENAI_API_KEY", ""
)
POLICE_ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "") or os.environ.get(
    "POLICE_ANTHROPIC_API_KEY", ""
)
POLICE_DEPLOYMENT: str = (
    "openai"
    if POLICE_OPENAI_API_KEY and POLICE_OPENAI_API_KEY != "no-key-set"
    else ("anthropic" if POLICE_ANTHROPIC_API_KEY and POLICE_ANTHROPIC_API_KEY != "no-key-set" else "")
)

POLICE_MODEL_OPENAI: str = os.environ.get("POLICE_MODEL", "gpt-4o-mini")
POLICE_MODEL_ANTHROPIC: str = os.environ.get("POLICE_MODEL", "claude-haiku-4-5-20251001")

POLICE_TEMPERATURE: float = 0.2
POLICE_MAX_TOKENS: int = int(os.environ.get("POLICE_MAX_TOKENS", "4096"))

# Truncation for long logs (sandwich: first 20%, last 80% by char count when over limit)
POLICE_MAX_TURN_CHARS: int = int(os.environ.get("POLICE_MAX_TURN_CHARS", "80000"))
POLICE_FIRST_FRACTION: float = 0.2

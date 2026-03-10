"""
Patrol swarm configuration: API keys, model, scaling, cleared state.
"""

from __future__ import annotations

import math
import os
from pathlib import Path


def patrol_agent_count(n_streams: int) -> int:
    """N = ceil(1 + log2(n)); n = number of log streams / OpenClaw agents."""
    if n_streams <= 0:
        return 1
    return max(1, math.ceil(1 + math.log2(n_streams)))


# API and model
PATROL_OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "") or os.environ.get(
    "PATROL_OPENAI_API_KEY", ""
)
PATROL_ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "") or os.environ.get(
    "PATROL_ANTHROPIC_API_KEY", ""
)
# Prefer OpenAI if set; otherwise Anthropic
PATROL_DEPLOYMENT: str = (
    "openai"
    if PATROL_OPENAI_API_KEY and PATROL_OPENAI_API_KEY != "no-key-set"
    else ("anthropic" if PATROL_ANTHROPIC_API_KEY and PATROL_ANTHROPIC_API_KEY != "no-key-set" else "")
)
PATROL_MODEL_OPENAI: str = os.environ.get("PATROL_MODEL", "gpt-4o-mini")
PATROL_MODEL_ANTHROPIC: str = os.environ.get("PATROL_MODEL", "claude-haiku-4-5-20251001")

# Version-based re-review: bump to re-queue cleared logs
RULESET_VERSION: str = os.environ.get("PATROL_RULESET_VERSION", "v1.0")
MODEL_VERSION: str = os.environ.get("PATROL_MODEL_VERSION", PATROL_MODEL_OPENAI or PATROL_MODEL_ANTHROPIC or "default")

# Patrol state DB (SQLite with WAL)
def patrol_state_db_path(log_dir: Path) -> Path:
    return Path(log_dir) / "patrol_state.db"

# Thresholds
CONFIDENCE_THRESHOLD: float = float(os.environ.get("PATROL_CONFIDENCE_THRESHOLD", "0.6"))
QUORUM_FRACTION: float = 0.5  # for N>2 orchestrator
PHEROMONE_DEPOSIT_AMOUNT: float = 0.4
PHEROMONE_DECAY_FACTOR: float = 0.85

# Generation
PATROL_TEMPERATURE: float = 0.1
PATROL_MAX_TOKENS: int = int(os.environ.get("PATROL_MAX_TOKENS", "2048"))

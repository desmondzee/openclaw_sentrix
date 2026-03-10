"""
Pydantic models for the Patrol Swarm (log patrol).

Data contracts for threat signals, votes, flags, and sweep results.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CLEAN = "CLEAN"


# Severity ordering for consensus (higher index = more severe)
SEVERITY_ORDER: dict[Severity, int] = {
    Severity.CLEAN: 0,
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
}


def max_severity(severities: list[Severity]) -> Severity:
    if not severities:
        return Severity.CLEAN
    return max(severities, key=lambda s: SEVERITY_ORDER[s])


# Categories for patrol flags (malicious definition)
class FlagCategory(str, Enum):
    PII_LEAK = "pii_leak"
    HARMFUL_INTENT = "harmful_intent"
    UNSAFE_TOOL_USE = "unsafe_tool_use"
    PROMPT_INJECTION = "prompt_injection"
    OTHER = "other"


class ThreatSignal(BaseModel):
    """Raw observation from a single patrol agent."""

    signal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_agent: str
    source_file: str = ""  # log stream id, e.g. 20260310T185751.json
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    domain: str = "log"
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    pii_labels_detected: list[str] = Field(default_factory=list)
    observation: str
    tool_calls_made: list[str] = Field(default_factory=list)
    raw_tool_outputs: dict[str, Any] = Field(default_factory=dict)
    category: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _source_file_from_target_agent_id(cls, data: Any) -> Any:
        if isinstance(data, dict) and "source_file" not in data and "target_agent_id" in data:
            data = {**data, "source_file": data["target_agent_id"]}
        return data

    class Config:
        use_enum_values = True


class ViolationVote(BaseModel):
    """Formal vote that a target should be referred (confidence >= threshold)."""

    vote_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_agent: str
    source_file: str = ""  # log stream id, e.g. 20260310T185751.json
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    pii_labels_detected: list[str] = Field(default_factory=list)
    observation: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    category: str | None = None
    run_id_ts: str = ""  # set when building consensus for flag emission

    @model_validator(mode="before")
    @classmethod
    def _source_file_from_target_agent_id(cls, data: Any) -> Any:
        if isinstance(data, dict) and "source_file" not in data and "target_agent_id" in data:
            data = {**data, "source_file": data["target_agent_id"]}
        return data

    class Config:
        use_enum_values = True


class PatrolFlag(BaseModel):
    """Referral produced when quorum is reached or single agent flags (K=1)."""

    flag_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_file: str = ""  # log stream id, e.g. 20260310T185751.json
    run_id_ts: str = ""
    consensus_severity: Severity
    consensus_confidence: float
    votes: list[ViolationVote] = Field(default_factory=list)
    pii_labels_union: list[str] = Field(default_factory=list)
    referral_summary: str = ""
    pheromone_level: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    categories: list[str] = Field(default_factory=list)  # pii_leak, harmful_intent, etc.

    @model_validator(mode="before")
    @classmethod
    def _source_file_from_target_agent_id(cls, data: Any) -> Any:
        if isinstance(data, dict) and "source_file" not in data and "target_agent_id" in data:
            data = {**data, "source_file": data["target_agent_id"]}
        return data

    class Config:
        use_enum_values = True

    def to_jsonl_dict(self) -> dict[str, Any]:
        """Serialize for patrol_flags.jsonl."""
        return self.model_dump(mode="json")


class SweepResult(BaseModel):
    """Metrics for a single sweep cycle."""

    sweep_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cycle_number: int
    agents_scanned: list[str]
    signals_posted: int
    votes_posted: int
    flags_produced: int
    pheromone_snapshot: dict[str, float] = Field(default_factory=dict)
    duration_ms: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

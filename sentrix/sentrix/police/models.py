"""
Unified CaseFile schema and police models.

Single LeadInvestigator output: crime_classification, severity_score,
confidence, case_facts, relevant_log_ids, verdict_summary.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CrimeClassification(str, Enum):
    """Taxonomy aligned with patrol categories and deprecated investigation."""

    PII_LEAK = "pii_leak"
    HARMFUL_INTENT = "harmful_intent"
    UNSAFE_TOOL_USE = "unsafe_tool_use"
    PROMPT_INJECTION = "prompt_injection"
    # Broader categories from deprecated (log-only context)
    EMAIL_PII_EXFILTRATION = "email_pii_exfiltration"
    CREDENTIAL_SOLICITATION = "credential_solicitation"
    SECRET_HARDCODING = "secret_hardcoding"
    BACKDOOR_INSERTION = "backdoor_insertion"
    CONFIDENTIAL_DATA_DISCLOSURE = "confidential_data_disclosure"
    UNKNOWN = "unknown"


class SeverityScore(str, Enum):
    """Severity for the case file (LOW/MEDIUM/HIGH/CRITICAL)."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CaseFile(BaseModel):
    """
    Final CaseFile produced by the Unified LeadInvestigator.

    Single JSON from the agent that read the primary source logs.
    """

    crime_classification: str  # CrimeClassification value or unknown
    severity_score: str = "MEDIUM"  # LOW | MEDIUM | HIGH | CRITICAL
    confidence: float = Field(ge=0.0, le=1.0)
    case_facts: str  # Step-by-step breakdown of what happened in the logs
    relevant_log_ids: list[str] = Field(default_factory=list)  # runId_ts or turn identifiers
    verdict_summary: str  # 2-3 sentence executive summary



def case_file_from_llm_dict(data: dict[str, Any]) -> CaseFile:
    """Build CaseFile from LLM JSON; normalize severity_score and confidence."""
    severity = (data.get("severity_score") or data.get("severity", "MEDIUM")).upper()
    if severity not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        severity = "MEDIUM"
    conf = data.get("confidence", 0.5)
    if isinstance(conf, (int, float)):
        if isinstance(conf, int) and conf > 1:
            conf = conf / 100.0  # allow 0-100 from LLM
        conf = max(0.0, min(1.0, float(conf)))
    else:
        conf = 0.5
    return CaseFile(
        crime_classification=str(data.get("crime_classification", "unknown")),
        severity_score=severity,
        confidence=conf,
        case_facts=str(data.get("case_facts", "")),
        relevant_log_ids=list(data.get("relevant_log_ids") or []),
        verdict_summary=str(data.get("verdict_summary", "")),
    )


# Row stored in police DB (case_files table)
def case_file_row(
    investigation_id: str,
    flag_id: str,
    source_file: str,
    case_file: CaseFile,
) -> dict[str, Any]:
    """Build row dict for case_files table (concluded_at, case_file_json)."""
    return {
        "investigation_id": investigation_id,
        "flag_id": flag_id,
        "source_file": source_file,
        "concluded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "case_file_json": case_file.model_dump_json(),
    }

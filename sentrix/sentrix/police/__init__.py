"""Police: Unified LeadInvestigator — single agent that reads patrol flags + raw logs and outputs CaseFile."""

from sentrix.police.models import CaseFile
from sentrix.police.run import run_investigation

__all__ = ["CaseFile", "run_investigation"]

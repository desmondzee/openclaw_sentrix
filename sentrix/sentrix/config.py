"""Sentrix configuration defaults and environment handling."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

SANDBOX_IMAGE = "sentrix-openclaw:latest"
GATEWAY_PORT = 18789
ROTATE_MINS = 10
SANDBOX_TIMEOUT_MINS = 60

# Paths inside the sandbox
SANDBOX_RAW_STREAM = "/data/raw-stream.jsonl"
SANDBOX_LOG_DIR = "/data/agent_logs"
SANDBOX_ENTRYPOINT = "/opt/sentrix/entrypoint.sh"
SANDBOX_COLLECTOR = "/opt/sentrix/collect_logs.py"

# Escalation: when to auto-invoke investigator on patrol flags
ESCALATION_LOW_ABOVE = "low_above"   # LOW, MEDIUM, HIGH
ESCALATION_MEDIUM_ABOVE = "medium_above"  # MEDIUM, HIGH
ESCALATION_HIGH_ONLY = "high_only"   # HIGH only


@dataclass
class SentrixConfig:
    log_dir: Path = field(default_factory=lambda: Path("./agent_logs"))
    rotate_mins: int = ROTATE_MINS
    reasoning: bool = True
    port: int = GATEWAY_PORT
    timeout_mins: int = SANDBOX_TIMEOUT_MINS
    image: str = SANDBOX_IMAGE
    verbose: bool = False
    extra_env: dict[str, str] = field(default_factory=dict)
    interactive_channels: list[str] = field(default_factory=list)
    patrol_enabled: bool = False
    escalation_level: str | None = None  # low_above | medium_above | high_only

    def sandbox_env(self) -> dict[str, str]:
        """Environment variables to inject into the sandbox container."""
        env: dict[str, str] = {
            # Raw stream capture
            "OPENCLAW_RAW_STREAM": "1",
            "OPENCLAW_RAW_STREAM_PATH": SANDBOX_RAW_STREAM,
            "OPENCLAW_DIAGNOSTICS": "*",
            # Sentrix log collector config
            "SENTRIX_ROTATE_MINS": str(self.rotate_mins),
            "SENTRIX_LOG_DIR": SANDBOX_LOG_DIR,
            "SENTRIX_PORT": str(self.port),
            # Secure defaults: no exec, sandbox all, fs restricted
            "OPENCLAW_TOOLS_EXEC_SECURITY": "deny",
            "OPENCLAW_TOOLS_FS_WORKSPACE_ONLY": "true",
            "OPENCLAW_SANDBOX_MODE": "all",
        }
        if self.reasoning:
            env["OPENCLAW_REASONING"] = "on"
            env["OPENCLAW_THINK"] = "adaptive"
        # extra_env can override any of the above (wizard-provided values win)
        env.update(self.extra_env)
        return env

    def ensure_log_dir(self) -> Path:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        return self.log_dir

    @property
    def dockerfile_dir(self) -> Path:
        """Path to the sandbox/ directory containing Dockerfile and scripts."""
        return Path(__file__).resolve().parent.parent / "sandbox"


def resolve_opensandbox_server() -> str:
    """Return the opensandbox-server binary path, or raise if not found."""
    custom = os.environ.get("SENTRIX_OPENSANDBOX_SERVER")
    if custom:
        return custom
    return "opensandbox-server"

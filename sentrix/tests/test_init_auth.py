"""Tests for sandbox init_auth: non-Anthropic provider and default model."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


def _run_init_auth(env: dict[str, str], init_auth_script: Path) -> None:
    env = {k: v for k, v in env.items() if v is not None}
    result = subprocess.run(
        [sys.executable, str(init_auth_script)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"init_auth failed: {result.stderr}"


def test_init_auth_openai_provider_and_default_model(tmp_path: Path) -> None:
    """With OPENAI_API_KEY and OPENCLAW_DEFAULT_MODEL, auth and openclaw.json use openai."""
    script = Path(__file__).resolve().parent.parent / "sentrix" / "sandbox" / "init_auth.py"
    env = {
        "SENTRIX_INIT_AUTH_BASE_DIR": str(tmp_path),
        "OPENAI_API_KEY": "sk-test-key",
        "OPENCLAW_DEFAULT_MODEL": "openai/gpt-5.4",
    }
    _run_init_auth(env, script)

    auth_path = tmp_path / "agents" / "main" / "agent" / "auth-profiles.json"
    assert auth_path.exists()
    auth_data = json.loads(auth_path.read_text())
    profiles = auth_data.get("profiles", {})
    assert "openai:default" in profiles
    assert profiles["openai:default"]["provider"] == "openai"
    assert profiles["openai:default"].get("key") == "sk-test-key"

    openclaw_path = tmp_path / "openclaw.json"
    assert openclaw_path.exists()
    config = json.loads(openclaw_path.read_text())
    primary = config.get("agents", {}).get("defaults", {}).get("model", {}).get("primary")
    assert primary == "openai/gpt-5.4"
    # Explicit main agent entry so gateway resolves model for "main"
    agents_list = config.get("agents", {}).get("list", [])
    assert len(agents_list) >= 1
    main_entry = next((a for a in agents_list if a.get("id") == "main"), None)
    assert main_entry is not None
    assert main_entry.get("model", {}).get("primary") == "openai/gpt-5.4"
    # auth.order tells OpenClaw which profile to use for this provider
    assert config.get("auth", {}).get("order", {}).get("openai") == ["openai:default"]


def test_init_auth_minimax_provider_and_default_model(tmp_path: Path) -> None:
    """With MINIMAX_API_KEY and OPENCLAW_DEFAULT_MODEL, auth and model use minimax."""
    script = Path(__file__).resolve().parent.parent / "sentrix" / "sandbox" / "init_auth.py"
    env = {
        "SENTRIX_INIT_AUTH_BASE_DIR": str(tmp_path),
        "MINIMAX_API_KEY": "minimax-test-key",
        "OPENCLAW_DEFAULT_MODEL": "minimax/MiniMax-M2.5",
    }
    _run_init_auth(env, script)

    auth_path = tmp_path / "agents" / "main" / "agent" / "auth-profiles.json"
    assert auth_path.exists()
    auth_data = json.loads(auth_path.read_text())
    profiles = auth_data.get("profiles", {})
    assert "minimax:default" in profiles
    assert profiles["minimax:default"]["provider"] == "minimax"

    config = json.loads((tmp_path / "openclaw.json").read_text())
    assert config.get("agents", {}).get("defaults", {}).get("model", {}).get("primary") == "minimax/MiniMax-M2.5"
    assert "minimax" in config.get("models", {}).get("providers", {})
    main_entry = next((a for a in config.get("agents", {}).get("list", []) if a.get("id") == "main"), None)
    assert main_entry is not None and main_entry.get("model", {}).get("primary") == "minimax/MiniMax-M2.5"
    assert config.get("auth", {}).get("order", {}).get("minimax") == ["minimax:default"]

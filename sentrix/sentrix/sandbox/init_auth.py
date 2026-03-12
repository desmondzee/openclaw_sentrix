#!/usr/bin/env python3
"""Initialize OpenClaw auth-profiles.json from environment variables.

OpenClaw requires an auth profile for its agents. While the CLI defaults to checking
the environment for Anthropic API keys, other providers require explicit auth profiles.
This script bridges the environment variables mapped by the Sentrix wizard into
the auth-profiles.json format expected by OpenClaw.

Some providers (like minimax, kimi/moonshot) also require model configuration
in openclaw.json to specify baseUrl, api type, and model definitions.

Auth store path: OpenClaw resolves auth per agent. This script MUST write to
/home/node/.openclaw/agents/main/agent/auth-profiles.json so the "main" agent
finds the keys. Provider IDs here must match wizard.py and the model string prefix
(e.g. "openai" for "openai/gpt-5.4").
"""

import json
import os
from pathlib import Path

# Env var -> provider ID. IDs must match wizard.py PROVIDERS[].id and model prefix (e.g. openai/gpt-5.4).
# Kimi Coding removed per docs: use Moonshot AI (moonshot) for Kimi models.
PROVIDERS = {
    "ANTHROPIC_API_KEY": "anthropic",
    "OPENAI_API_KEY": "openai",
    "GEMINI_API_KEY": "google",
    "OPENROUTER_API_KEY": "openrouter",
    "XAI_API_KEY": "xai",
    "MISTRAL_API_KEY": "mistral",
    "GROQ_API_KEY": "groq",
    "TOGETHER_API_KEY": "together",
    "MINIMAX_API_KEY": "minimax",
    "MOONSHOT_API_KEY": "moonshot",
}

# Model provider configurations per OpenClaw docs (openai, moonshot, minimax).
# Moonshot: https://docs.openclaw.ai/providers/moonshot — international keys use api.moonshot.ai/v1 only.
MOONSHOT_MODELS = [
    {"id": "kimi-k2.5", "name": "Kimi K2.5", "reasoning": False, "contextWindow": 256000, "maxTokens": 8192},
    {"id": "kimi-k2-0905-preview", "name": "Kimi K2 0905 Preview", "reasoning": False, "contextWindow": 256000, "maxTokens": 8192},
    {"id": "kimi-k2-turbo-preview", "name": "Kimi K2 Turbo", "reasoning": False, "contextWindow": 256000, "maxTokens": 8192},
    {"id": "kimi-k2-thinking", "name": "Kimi K2 Thinking", "reasoning": True, "contextWindow": 256000, "maxTokens": 8192},
    {"id": "kimi-k2-thinking-turbo", "name": "Kimi K2 Thinking Turbo", "reasoning": True, "contextWindow": 256000, "maxTokens": 8192},
]
MODEL_PROVIDER_CONFIG = {
    "minimax": {
        "baseUrl": "https://api.minimax.io/anthropic",
        "api": "anthropic-messages",
        "models": [
            {"id": "MiniMax-M2.5", "name": "MiniMax M2.5", "reasoning": True, "contextWindow": 200000, "maxTokens": 8192},
            {"id": "MiniMax-M2.5-highspeed", "name": "MiniMax M2.5 Highspeed", "reasoning": True, "contextWindow": 200000, "maxTokens": 8192},
        ],
    },
    "moonshot": {
        "baseUrl": "https://api.moonshot.ai/v1",
        "api": "openai-completions",
        "models": MOONSHOT_MODELS,
    },
}

def _base_dir() -> Path:
    """Base dir for OpenClaw config (allow override for tests)."""
    override = os.environ.get("SENTRIX_INIT_AUTH_BASE_DIR")
    if override:
        return Path(override)
    return Path("/home/node/.openclaw")


def _normalize_api_key(value: str | None) -> str:
    """Strip whitespace and newlines; pasted keys often have trailing CR/LF causing 401."""
    if not value:
        return ""
    return value.replace("\r", "").replace("\n", "").strip()


def main():
    base = _base_dir()
    agent_dir = base / "agents" / "main" / "agent"
    agent_dir.mkdir(parents=True, exist_ok=True)

    auth_path = agent_dir / "auth-profiles.json"
    
    profiles = {}
    providers_configured = set()  # Track which providers need model config
    
    for env_var, provider_id in PROVIDERS.items():
        raw = os.environ.get(env_var)
        api_key = _normalize_api_key(raw) if raw else ""
        if api_key:
            profile_key = f"{provider_id}:default"
            profiles[profile_key] = {
                "type": "api_key",
                "provider": provider_id,
                "key": api_key,
            }
            providers_configured.add(provider_id)
            
    if not profiles:
        print("[sentrix/init_auth] No API keys found in environment to configure OpenClaw.")
        return
        
    auth_data = {
        "version": 1,
        "profiles": profiles
    }
    
    # Merge with existing if any (unlikely inside fresh sandbox)
    if auth_path.exists():
        try:
            existing = json.loads(auth_path.read_text("utf-8"))
            if "profiles" in existing:
                existing["profiles"].update(profiles)
                auth_data = existing
        except Exception as e:
            print(f"[sentrix/init_auth] Warning: could not read existing auth profiles: {e}")
            
    auth_path.write_text(json.dumps(auth_data, indent=2), "utf-8")
    print(f"[sentrix/init_auth] Initialized {len(profiles)} auth profiles for OpenClaw main agent.")

    # Load or create openclaw config
    openclaw_config_path = base / "openclaw.json"
    try:
        if openclaw_config_path.exists():
            config_data = json.loads(openclaw_config_path.read_text("utf-8"))
        else:
            config_data = {}
            openclaw_config_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"[sentrix/init_auth] Warning: could not read existing openclaw.json: {e}")
        config_data = {}

    # Per OpenClaw docs: config can have env: { OPENAI_API_KEY: "sk-..." } so the key is available.
    # Inject normalized env values (strip CR/LF) so substitution and auth never see trailing newlines → 401.
    config_data.setdefault("env", {})
    for env_var, provider_id in PROVIDERS.items():
        raw = os.environ.get(env_var)
        val = _normalize_api_key(raw) if raw else ""
        if val:
            config_data["env"][env_var] = val
    if config_data["env"]:
        print(f"[sentrix/init_auth] Set config env for: {list(config_data['env'].keys())}")

    # Add model provider configurations for providers that need them (Moonshot, Minimax per docs).
    # Write literal apiKey into the provider so OpenClaw has the key even if env substitution
    # or auth-profile resolution fails; per https://docs.openclaw.ai/providers/moonshot
    for provider_id in providers_configured:
        if provider_id in MODEL_PROVIDER_CONFIG:
            model_config = MODEL_PROVIDER_CONFIG[provider_id]
            if provider_id == "minimax":
                env_key = "MINIMAX_API_KEY"
            elif provider_id == "moonshot":
                env_key = "MOONSHOT_API_KEY"
            else:
                env_key = f"{provider_id.upper().replace('-', '_')}_API_KEY"

            raw_key = os.environ.get(env_key)
            key_val = _normalize_api_key(raw_key) if raw_key else ""
            # Prefer literal key so provider config is self-contained and 401 from substitution is impossible
            api_key_value = key_val if key_val else f"${{{env_key}}}"

            config_data.setdefault("models", {}).setdefault("mode", "merge")
            config_data["models"].setdefault("providers", {})[provider_id] = {
                "baseUrl": model_config["baseUrl"],
                "api": model_config["api"],
                "apiKey": api_key_value,
                "models": model_config["models"],
            }
            print(f"[sentrix/init_auth] Added model provider config for: {provider_id}")
            if provider_id == "moonshot" and key_val:
                print("[sentrix/init_auth] Moonshot: key set in env, auth profile, and models.providers.moonshot.apiKey (baseUrl=api.moonshot.ai/v1). If 401 persists, verify key at platform.moonshot.ai and try: curl -s https://api.moonshot.ai/v1/models -H 'Authorization: Bearer YOUR_KEY'")

    # Set default model so OpenClaw uses the wizard-selected provider (path: agents.defaults.model.primary).
    # Also set agents.list with an explicit "main" entry so the default agent has the model even when
    # no other agents are defined (avoids relying solely on defaults merge in all code paths).
    default_model = os.environ.get("OPENCLAW_DEFAULT_MODEL")
    if default_model:
        config_data.setdefault("agents", {})
        config_data["agents"].setdefault("defaults", {})["model"] = {"primary": default_model}
        # Explicit main agent entry so resolveAgentConfig(cfg, "main") returns this model.
        if "list" not in config_data["agents"] or not config_data["agents"]["list"]:
            config_data["agents"]["list"] = [
                {"id": "main", "default": True, "model": {"primary": default_model}}
            ]
        # Set auth.order for the selected provider so OpenClaw uses our profile (e.g. openai:default).
        try:
            provider_from_model = default_model.split("/", 1)[0].strip().lower() if "/" in default_model else ""
            if provider_from_model and provider_from_model in providers_configured:
                config_data.setdefault("auth", {})
                config_data["auth"].setdefault("order", {})
                profile_id = f"{provider_from_model}:default"
                config_data["auth"]["order"][provider_from_model] = [profile_id]
                print(f"[sentrix/init_auth] Set auth.order.{provider_from_model} = [{profile_id!r}]")
        except Exception as e:
            print(f"[sentrix/init_auth] Warning: could not set auth.order: {e}")
        print(f"[sentrix/init_auth] Set OpenClaw default model to: {default_model}")

    # Write the updated config
    try:
        openclaw_config_path.write_text(json.dumps(config_data, indent=2), "utf-8")
        print(f"[sentrix/init_auth] Updated openclaw.json with model provider configs")
    except Exception as e:
        print(f"[sentrix/init_auth] Warning: could not write openclaw.json: {e}")

    # Verbose: print what was written so host/sync can verify provider and model.
    print(f"[sentrix/init_auth] Auth store path: {auth_path}")
    print(f"[sentrix/init_auth] Profile keys: {list(auth_data.get('profiles', {}).keys())}")
    agents_defaults = config_data.get("agents", {}).get("defaults", {})
    model_cfg = agents_defaults.get("model") if isinstance(agents_defaults, dict) else None
    if model_cfg:
        primary = model_cfg.get("primary") if isinstance(model_cfg, dict) else None
        print(f"[sentrix/init_auth] openclaw.json agents.defaults.model.primary: {primary}")
    else:
        print("[sentrix/init_auth] openclaw.json agents.defaults.model: (not set)")

if __name__ == "__main__":
    main()

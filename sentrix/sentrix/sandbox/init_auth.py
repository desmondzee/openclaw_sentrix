#!/usr/bin/env python3
"""Initialize OpenClaw auth-profiles.json from environment variables.

OpenClaw requires an auth profile for its agents. While the CLI defaults to checking
the environment for Anthropic API keys, other providers require explicit auth profiles.
This script bridges the environment variables mapped by the Sentrix wizard into
the auth-profiles.json format expected by OpenClaw.
"""

import json
import os
from pathlib import Path

PROVIDERS = {
    "ANTHROPIC_API_KEY": "anthropic",
    "OPENAI_API_KEY": "openai",
    "GEMINI_API_KEY": "google",
    "OPENROUTER_API_KEY": "openrouter",
    "XAI_API_KEY": "xai",
    "MISTRAL_API_KEY": "mistral",
    "GROQ_API_KEY": "groq",
    "TOGETHER_API_KEY": "together",
}

def main():
    agent_dir = Path("/home/node/.openclaw/agents/main/agent")
    agent_dir.mkdir(parents=True, exist_ok=True)
    
    auth_path = agent_dir / "auth-profiles.json"
    
    profiles = {}
    
    for env_var, provider_id in PROVIDERS.items():
        api_key = os.environ.get(env_var)
        if api_key:
            profile_key = f"{provider_id}:default"
            profiles[profile_key] = {
                "type": "api_key",
                "provider": provider_id,
                "key": api_key,
            }
            
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

    # Also inject the default model if present
    default_model = os.environ.get("OPENCLAW_DEFAULT_MODEL")
    if default_model:
        openclaw_config_path = Path("/home/node/.openclaw/openclaw.json")
        try:
            if openclaw_config_path.exists():
                config_data = json.loads(openclaw_config_path.read_text("utf-8"))
            else:
                config_data = {}
                openclaw_config_path.parent.mkdir(parents=True, exist_ok=True)
                
            config_data.setdefault("agents", {}).setdefault("defaults", {})["model"] = default_model
            
            openclaw_config_path.write_text(json.dumps(config_data, indent=2), "utf-8")
            print(f"[sentrix/init_auth] Set OpenClaw default model to: {default_model}")
        except Exception as e:
            print(f"[sentrix/init_auth] Warning: could not set default model in openclaw.json: {e}")

if __name__ == "__main__":
    main()

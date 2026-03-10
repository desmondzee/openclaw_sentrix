"""Interactive setup wizard for first-run configuration.

Walks the user through provider selection, API key entry, model choice,
channel configuration, and security -- using arrow-key menus.
"""

from __future__ import annotations

import os

import questionary
from questionary import Choice, Separator
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

# ---------------------------------------------------------------------------
# Provider / model / thinking definitions
# ---------------------------------------------------------------------------

PROVIDERS = [
    {"id": "anthropic", "name": "Anthropic", "env": "ANTHROPIC_API_KEY", "hint": "Claude models"},
    {"id": "openai", "name": "OpenAI", "env": "OPENAI_API_KEY", "hint": "GPT / o-series models"},
    {"id": "google", "name": "Google", "env": "GEMINI_API_KEY", "hint": "Gemini models"},
    {"id": "openrouter", "name": "OpenRouter", "env": "OPENROUTER_API_KEY", "hint": "Multi-provider gateway"},
    {"id": "xai", "name": "xAI", "env": "XAI_API_KEY", "hint": "Grok models"},
    {"id": "mistral", "name": "Mistral AI", "env": "MISTRAL_API_KEY", "hint": "Mistral / Codestral"},
    {"id": "groq", "name": "Groq", "env": "GROQ_API_KEY", "hint": "Fast inference"},
    {"id": "together", "name": "Together AI", "env": "TOGETHER_API_KEY", "hint": "Open-source models"},
]

MODELS_BY_PROVIDER: dict[str, list[dict[str, str]]] = {
    "anthropic": [
        {"id": "anthropic/claude-sonnet-4-6", "name": "Claude Sonnet 4.6 (recommended)"},
        {"id": "anthropic/claude-opus-4-6", "name": "Claude 4.6 Opus"},
        {"id": "anthropic/claude-haiku-4-5-20251001", "name": "Claude 4.5 Haiku (fast)"},
    ],
    "openai": [
        {"id": "openai/gpt-4.1", "name": "GPT-4.1 (recommended)"},
        {"id": "openai/o3", "name": "o3 (reasoning)"},
        {"id": "openai/o4-mini", "name": "o4-mini (fast reasoning)"},
        {"id": "openai/gpt-4.1-mini", "name": "GPT-4.1 Mini (fast)"},
    ],
    "google": [
        {"id": "google/gemini-2.5-pro", "name": "Gemini 2.5 Pro (recommended)"},
        {"id": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash (fast)"},
    ],
    "openrouter": [
        {"id": "anthropic/claude-sonnet-4-6", "name": "Claude Sonnet 4.6 via OpenRouter"},
        {"id": "openai/gpt-4.1", "name": "GPT-4.1 via OpenRouter"},
        {"id": "google/gemini-2.5-pro", "name": "Gemini 2.5 Pro via OpenRouter"},
    ],
    "xai": [
        {"id": "xai/grok-3", "name": "Grok 3"},
        {"id": "xai/grok-3-mini", "name": "Grok 3 Mini (fast)"},
    ],
    "mistral": [
        {"id": "mistral/mistral-large-latest", "name": "Mistral Large"},
        {"id": "mistral/codestral-latest", "name": "Codestral"},
    ],
    "groq": [
        {"id": "groq/llama-4-scout-17b", "name": "Llama 4 Scout 17B"},
        {"id": "groq/llama-3.3-70b-versatile", "name": "Llama 3.3 70B"},
    ],
    "together": [
        {"id": "together/meta-llama/Llama-4-Maverick-17B-128E", "name": "Llama 4 Maverick"},
        {"id": "together/deepseek-ai/DeepSeek-R1", "name": "DeepSeek R1"},
    ],
}

THINKING_LEVELS = [
    {"id": "adaptive", "name": "Adaptive (recommended)", "hint": "Model decides when to think deeply"},
    {"id": "high", "name": "High", "hint": "Always think deeply"},
    {"id": "low", "name": "Low", "hint": "Minimal thinking"},
    {"id": "off", "name": "Off", "hint": "No extended thinking"},
]

# ---------------------------------------------------------------------------
# Channel definitions
# ---------------------------------------------------------------------------

CHANNELS = [
    {
        "id": "telegram",
        "name": "Telegram",
        "hint": "Bot via BotFather token",
        "env": "TELEGRAM_BOT_TOKEN",
        "prompt": "Telegram Bot Token (from @BotFather)",
        "help": "Create a bot at https://t.me/BotFather and paste the token.",
        "interactive_login": False,
    },
    {
        "id": "discord",
        "name": "Discord",
        "hint": "Bot token from Discord Developer Portal",
        "env": "DISCORD_BOT_TOKEN",
        "prompt": "Discord Bot Token",
        "help": "Create an app at https://discord.com/developers/applications",
        "interactive_login": False,
    },
    {
        "id": "slack",
        "name": "Slack",
        "hint": "Bot token from Slack API",
        "env": "SLACK_BOT_TOKEN",
        "prompt": "Slack Bot Token (xoxb-...)",
        "help": "Create an app at https://api.slack.com/apps",
        "interactive_login": False,
    },
    {
        "id": "whatsapp",
        "name": "WhatsApp",
        "hint": "QR code will appear in terminal",
        "env": None,
        "prompt": None,
        "help": "WhatsApp links via QR code. After the sandbox starts,\n"
                "the QR code will be displayed directly in this terminal.\n"
                "Scan it with your phone (WhatsApp > Linked Devices > Link a Device).",
        "interactive_login": True,
    },
    {
        "id": "signal",
        "name": "Signal",
        "hint": "Via signal-cli REST API",
        "env": None,
        "prompt": None,
        "help": "Signal uses signal-cli. Configure after gateway starts via:\n  openclaw channels add signal",
        "interactive_login": False,
    },
]


def _select(message: str, choices: list[Choice]) -> str:
    """Arrow-key select prompt. Exits on Ctrl+C."""
    result = questionary.select(
        message,
        choices=choices,
        use_arrow_keys=True,
        use_shortcuts=False,
    ).ask()
    if result is None:
        raise SystemExit(0)
    return result


def _confirm(message: str, default: bool = True) -> bool:
    result = questionary.confirm(message, default=default).ask()
    if result is None:
        raise SystemExit(0)
    return result


def _password(message: str) -> str:
    result = questionary.password(message).ask()
    if result is None:
        raise SystemExit(0)
    return result.strip()


# ---------------------------------------------------------------------------
# Wizard steps
# ---------------------------------------------------------------------------

def _step_provider() -> tuple[str, str, str]:
    """Step 1: Provider + API key. Returns (provider_id, env_var, api_key)."""
    console.print()
    console.print("[bold]Step 1:[/bold] LLM Provider & API Key")

    detected: list[tuple[str, dict]] = []
    for p in PROVIDERS:
        val = os.environ.get(p["env"])
        if val:
            detected.append((val, p))

    choices: list[Choice | Separator] = []
    if detected:
        choices.append(Separator("── Detected in environment ──"))
        for _val, p in detected:
            choices.append(Choice(
                title=f"{p['name']}  ({p['env']} found)",
                value=f"detected:{p['id']}",
            ))
        choices.append(Separator("── All providers ──"))

    for p in PROVIDERS:
        choices.append(Choice(
            title=f"{p['name']}  ({p['hint']})",
            value=p["id"],
        ))

    raw = _select("Select your LLM provider:", choices)

    if raw.startswith("detected:"):
        provider_id = raw.split(":", 1)[1]
        provider = next(p for p in PROVIDERS if p["id"] == provider_id)
        api_key = os.environ[provider["env"]]
        console.print(f"  Using [bold]{provider['env']}[/bold] from environment.")
        return provider_id, provider["env"], api_key

    provider = next(p for p in PROVIDERS if p["id"] == raw)
    console.print(f"  [dim]Get your key from the {provider['name']} dashboard.[/dim]")
    api_key = _password(f"  {provider['env']}:")
    if not api_key:
        console.print("  [red]API key cannot be empty.[/red]")
        raise SystemExit(1)
    return provider["id"], provider["env"], api_key


def _step_model(provider_id: str) -> str:
    """Step 2: Model selection."""
    console.print()
    console.print("[bold]Step 2:[/bold] Choose a model")

    models = MODELS_BY_PROVIDER.get(provider_id, [])
    if not models:
        return questionary.text(
            "  Enter model ID (e.g. provider/model-name):"
        ).ask() or ""

    choices = [Choice(title=m["name"], value=m["id"]) for m in models]
    return _select("Select model:", choices)


def _step_thinking() -> tuple[str, bool]:
    """Step 3: Thinking level + reasoning capture."""
    console.print()
    console.print("[bold]Step 3:[/bold] Reasoning & Thinking")

    choices = [
        Choice(title=f"{t['name']}  ({t['hint']})", value=t["id"])
        for t in THINKING_LEVELS
    ]
    level = _select("Thinking level:", choices)
    capture = _confirm("Capture reasoning/thinking tokens in logs?", default=True)
    return level, capture


def _step_channels() -> tuple[dict[str, str], list[str]]:
    """Step 4: Channel setup. Returns (env_vars, interactive_channels)."""
    console.print()
    console.print("[bold]Step 4:[/bold] Connect messaging channels")
    console.print("  [dim]You can skip this and add channels later via openclaw channels add.[/dim]")

    env: dict[str, str] = {}
    interactive: list[str] = []

    channel_choices = [
        Choice(title=f"{ch['name']}  ({ch['hint']})", value=ch["id"])
        for ch in CHANNELS
    ]
    channel_choices.append(Separator())
    channel_choices.append(Choice(title="Skip — configure channels later", value="__skip__"))

    while True:
        selected = _select("Add a channel:", channel_choices)
        if selected == "__skip__":
            break

        ch = next(c for c in CHANNELS if c["id"] == selected)

        if ch["env"] and ch["prompt"]:
            console.print(f"  [dim]{ch['help']}[/dim]")
            token = _password(f"  {ch['prompt']}:")
            if token:
                env[ch["env"]] = token
                console.print(f"  [green]{ch['name']} configured.[/green]")
            else:
                console.print(f"  [yellow]Skipped (empty token).[/yellow]")
        elif ch.get("interactive_login"):
            console.print(f"  [dim]{ch['help']}[/dim]")
            interactive.append(ch["id"])
            console.print(f"  [green]{ch['name']} — QR code will appear after sandbox starts.[/green]")
        else:
            console.print(f"  [dim]{ch['help']}[/dim]")
            console.print(f"  [green]{ch['name']} — will be configured after gateway starts.[/green]")

        if not _confirm("Add another channel?", default=False):
            break

    return env, interactive


def _step_patrol() -> tuple[bool, str | None]:
    """Step 5: Patrol swarm and escalation. Returns (patrol_enabled, escalation_level)."""
    console.print()
    console.print("[bold]Step 5:[/bold] Patrol & investigator")
    console.print("  [dim]Patrol reviews agent logs and flags suspicious content. The investigator writes a report for selected flags.[/dim]")

    patrol_enabled = _confirm("Enable patrol swarm? (reviews logs, writes to patrol_flags.jsonl)", default=False)
    escalation_level: str | None = None
    if patrol_enabled:
        choices = [
            Choice(title="Low and above — escalate LOW, MEDIUM, HIGH flags to investigator", value="low_above"),
            Choice(title="Medium and above — escalate MEDIUM and HIGH only", value="medium_above"),
            Choice(title="High only — escalate HIGH severity only", value="high_only"),
        ]
        escalation_level = _select("When should the investigator auto-run on a flag?", choices)
    return patrol_enabled, escalation_level


def _step_security() -> dict[str, str]:
    """Step 6: Security confirmation. Returns env vars for security config."""
    console.print()
    console.print("[bold]Step 6:[/bold] Security")
    console.print(Panel(
        "[bold]Sentrix applies these secure defaults:[/bold]\n\n"
        "  * Shell/command execution: [red]denied[/red]\n"
        "  * Filesystem access: [yellow]workspace only[/yellow]\n"
        "  * Agent sandboxing: [green]all agents sandboxed[/green]\n"
        "  * DM policy: [green]pairing required[/green] (unknown senders must be approved)\n"
        "  * Tools: read, write, edit files in workspace only\n\n"
        "[dim]These can be relaxed later in ~/.openclaw/openclaw.json[/dim]",
        border_style="green",
        title="Security Defaults",
    ))

    _confirm("Continue with secure defaults?", default=True)

    return {
        "OPENCLAW_TOOLS_EXEC_SECURITY": "deny",
        "OPENCLAW_TOOLS_FS_WORKSPACE_ONLY": "true",
        "OPENCLAW_SANDBOX_MODE": "all",
    }


# ---------------------------------------------------------------------------
# Main wizard entry point
# ---------------------------------------------------------------------------

def run_setup_wizard() -> tuple[dict[str, str], list[str], bool, str | None]:
    """Interactive setup wizard. Returns (env_vars, interactive_channels, patrol_enabled, escalation_level)."""
    console.print()
    console.print(Panel.fit(
        "[bold]Sentrix Setup[/bold]\n"
        "Configure your sandboxed OpenClaw instance step by step.\n"
        "[dim]Use arrow keys to navigate, Enter to select, Ctrl+C to cancel.[/dim]",
        border_style="cyan",
    ))

    # Step 1: Provider + API key
    provider_id, env_var, api_key = _step_provider()

    # Step 2: Model
    model_id = _step_model(provider_id)

    # Step 3: Thinking / reasoning
    think_level, capture_reasoning = _step_thinking()

    # Step 4: Channels
    channel_env, interactive_channels = _step_channels()

    # Step 5: Patrol & escalation
    patrol_enabled, escalation_level = _step_patrol()

    # Step 6: Security
    security_env = _step_security()

    # Summary
    console.print()
    provider_name = next((p["name"] for p in PROVIDERS if p["id"] == provider_id), provider_id)
    model_name = model_id
    for m in MODELS_BY_PROVIDER.get(provider_id, []):
        if m["id"] == model_id:
            model_name = m["name"]
            break

    summary = Table(title="Configuration Summary", border_style="cyan", show_header=False)
    summary.add_column("Setting", style="bold")
    summary.add_column("Value")
    summary.add_row("Provider", provider_name)
    key_display = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 16 else "***"
    summary.add_row("API Key", f"{env_var} = {key_display}")
    summary.add_row("Model", model_name)
    summary.add_row("Thinking", think_level)
    summary.add_row("Reasoning capture", "Yes" if capture_reasoning else "No")

    all_ch_names: list[str] = []
    for ch in CHANNELS:
        if ch["env"] and ch["env"] in channel_env:
            all_ch_names.append(ch["name"])
        elif ch["id"] in interactive_channels:
            all_ch_names.append(ch["name"])
    summary.add_row("Channels", ", ".join(all_ch_names) if all_ch_names else "None (configure later)")
    summary.add_row("Patrol", "Yes" if patrol_enabled else "No")
    if patrol_enabled and escalation_level:
        esc_label = {"low_above": "Low and above", "medium_above": "Medium and above", "high_only": "High only"}.get(escalation_level, escalation_level)
        summary.add_row("Investigator escalation", esc_label)
    summary.add_row("Security", "High (exec denied, sandbox all, pairing on)")
    console.print(summary)
    console.print()

    if not _confirm("Start sandbox with this configuration?", default=True):
        raise SystemExit(0)

    # Build final env dict
    env: dict[str, str] = {
        env_var: api_key,
        "OPENCLAW_DEFAULT_MODEL": model_id,
        "OPENCLAW_THINK": think_level,
    }
    if capture_reasoning:
        env["OPENCLAW_REASONING"] = "on"

    env.update(channel_env)
    env.update(security_env)

    return env, interactive_channels, patrol_enabled, escalation_level

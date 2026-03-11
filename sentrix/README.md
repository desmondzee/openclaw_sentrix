# Sentrix

**Agentic police for [OpenClaw](https://github.com/openclaw/openclaw).** Sentrix uses AI agents to watch AI agents — a patrol swarm continuously monitors your OpenClaw instance for PII leaks, harmful intent, unsafe tool use, and prompt injection, then escalates flagged incidents to an automated investigator that produces case files.

## How It Works

Sentrix runs OpenClaw inside a sandboxed Docker container, captures every LLM API call, and feeds the logs into a multi-layered oversight system:

```
┌──────────────────────────────────────────────────────┐
│  Patrol Swarm (LangGraph)                            │
│    ├── Orchestrator assigns log streams              │
│    ├── N patrol agents scan in parallel              │
│    │     flags: PII · harmful intent · unsafe tools  │
│    │            prompt injection · credentials       │
│    ├── Adjudicator: quorum vote + pheromone consensus│
│    └── → patrol_flags.jsonl                          │
│                                                      │
│  Police Investigator (LangGraph)                     │
│    ├── LeadInvestigator reads flags + raw logs        │
│    ├── Classifies per crime taxonomy                 │
│    ├── Multi-round context expansion                 │
│    └── → CaseFile (reports/*.json + police.db)       │
│                                                      │
│  Escalation Queue                                    │
│    └── Priority: HIGH → MEDIUM → LOW                 │
│        Auto-invokes investigator per threshold        │
└──────────────────────────────────────────────────────┘
```

**Patrol agents** scale logarithmically — `N = ⌈1 + log₂(n)⌉` agents for `n` log streams — and coordinate via a pheromone map (ant-colony-inspired) for consensus. When a quorum of agents flags the same stream, a `PatrolFlag` is emitted. The **investigator** then reviews the flag alongside the raw log turns, classifies the incident using a crime taxonomy (PII leak, harmful intent, unsafe tool use, prompt injection, credential solicitation, secret hardcoding, confidential data disclosure), and produces a `CaseFile` with severity, evidence, and a verdict summary.

## Install

```bash
pip install openclaw-sentrix
```

### Prerequisites

> **⚠️ Docker must be installed and running.** Sentrix runs OpenClaw inside a Docker container. Install [Docker Desktop](https://docs.docker.com/get-docker/) and make sure it's running before using Sentrix.

- **Python 3.10+**
- **Docker** (running — verify with `docker info`)

## Quick Start

```bash
# Interactive setup — walks you through provider, API key, model,
# channels, patrol, and security configuration
sentrix run
```

The wizard walks you through:

1. **Provider & API key** — Anthropic, OpenAI, Google, OpenRouter, xAI, Mistral, Groq, Together AI (auto-detects keys in your environment)
2. **Model** — choose a model for your provider
3. **Reasoning** — set thinking depth (adaptive / high / low / off)
4. **Channels** — connect Telegram, Discord, Slack, WhatsApp, or Signal
5. **Web search** — configure Brave Search API key for agent tools
6. **Patrol** — enable the patrol swarm and set escalation threshold
7. **Security** — confirms secure defaults (exec denied, all agents sandboxed, pairing required)

## CLI Reference

```
sentrix run [OPTIONS]     Start sandbox + patrol + bridge; run until Ctrl+C
sentrix chat [OPTIONS]    Attach to running sandbox and chat with the agent
sentrix bridge [OPTIONS]  Run WSS bridge only (for the web UI)
sentrix build [OPTIONS]   Build the sandbox Docker image
sentrix logs [OPTIONS]    View captured API call log files
sentrix stop              Stop running containers
sentrix police            View case files and patrol flags
sentrix police investigate <FLAG_ID>  Run investigation for a patrol flag
```

### `sentrix run`

| Flag | Default | Description |
|------|---------|-------------|
| `--log-dir PATH` | `./agent_logs` | Host directory for logs and case files |
| `--rotate-mins N` | `10` | Log rotation interval in minutes |
| `--reasoning / --no-reasoning` | `on` | Capture reasoning/thinking tokens |
| `--port N` | `18789` | Gateway port |
| `--timeout N` | `60` | Sandbox timeout in minutes |
| `-e KEY=VALUE` | | Extra env vars (repeatable) |
| `--image TAG` | `sentrix-openclaw:latest` | Override sandbox image |
| `--patrol` | | Enable patrol swarm |
| `--escalation LEVEL` | | Auto-escalate flags (`low_above`, `medium_above`, `high_only`) |
| `--nobridge` | | Skip the WSS bridge |
| `--verbose` | | Verbose output |

### Patrol Swarm

When patrol is enabled (via wizard or `--patrol`), Sentrix runs a LangGraph-based safety patrol in the background:

- Reads synced agent logs from `log_dir`
- Scales patrol agents logarithmically: `N = ⌈1 + log₂(n)⌉`
- Each agent scans for: **PII/credentials**, **harmful intent**, **unsafe tool use**, **prompt injection**
- Multi-agent quorum voting produces `PatrolFlag` entries → `patrol_flags.jsonl`
- Pheromone-based coordination prevents redundant scans
- Cleared state stored in `patrol_state.db` (SQLite, WAL mode)

| Env var | Description |
|---------|-------------|
| `OPENAI_API_KEY` | API key for patrol LLM (preferred) |
| `ANTHROPIC_API_KEY` | Fallback API key for patrol LLM |
| `PATROL_MODEL` | Model name (e.g. `gpt-4o-mini`, `claude-haiku-4-5-20251001`) |
| `PATROL_CONFIDENCE_THRESHOLD` | Min confidence to emit a flag (default `0.6`) |
| `PATROL_RULESET_VERSION` | Bump to re-review all logs |
| `PATROL_MODEL_VERSION` | Bump when changing patrol model |

### Police Investigator

Flags that meet the escalation threshold are queued for the **LeadInvestigator** — a LangGraph agent that:

1. Loads the flagged log turns plus adjacent files (prev/next)
2. Can request additional context (backward/forward) for up to 3 rounds
3. Classifies the incident using a crime taxonomy
4. Produces a `CaseFile` with severity (LOW → CRITICAL), evidence, and verdict

Case files are persisted to `police.db` and written as JSON reports to `agent_logs/reports/`.

View results with:
```bash
sentrix police                        # list cases and flags
sentrix police --cases                # show case files only
sentrix police --clogs                # show patrol flags
sentrix police investigate <FLAG_ID>  # manually trigger investigation
```

### `sentrix chat`

Attach to a sandbox started by `sentrix run` and interact with the OpenClaw agent directly in your terminal.

| Flag | Default | Description |
|------|---------|-------------|
| `--dir PATH` | `./agent_logs` | Log directory (must match `sentrix run`) |
| `--message`, `-m TEXT` | | Send a single message and exit |

### Web UI (Your Claw)

> **⚠️ The web frontend is currently under development.**

The [openclaw-sentrix](https://openclaw-sentrix.vercel.app) Next.js app has a **Your Claw** tab for chatting with OpenClaw in the browser. The app connects to your local sandbox via WSS (secure WebSocket) through the bridge.

1. Start the sandbox: `sentrix run` (bridge runs automatically on port 8766)
2. Open the app → **Your Claw** → set Bridge URL to `wss://localhost:8766`

First-time cert trust: open `https://localhost:8765` and `https://localhost:8766` in your browser to accept the self-signed certificate, then click Reconnect in the app.

### Non-interactive Mode

Skip the wizard by passing API keys directly:

```bash
sentrix run -e ANTHROPIC_API_KEY=sk-ant-... -e OPENCLAW_DEFAULT_MODEL=anthropic/claude-sonnet-4-6 --patrol
```

## Security Defaults

| Setting | Value | Meaning |
|---------|-------|---------|
| Shell/exec access | `deny` | Agent cannot run shell commands |
| Filesystem | `workspace only` | Read/write restricted to workspace |
| Sandboxing | `all` | Every agent runs in a sandbox container |
| DM policy | `pairing` | Unknown senders must be approved by operator |

## Architecture

```
┌─────────────────────────────────────┐
│ Host                                │
│  sentrix run                        │
│    ├── opensandbox-server           │
│    ├── create sandbox → health check│
│    ├── channel login (stream QR)    │
│    ├── log sync (periodic pull)     │
│    ├── patrol swarm (background)    │
│    ├── police investigator (queue)  │
│    ├── WSS bridge (port 8766)       │
│    └── ./agent_logs/*.json          │
│  sentrix chat (other terminal)      │
│    └── reconnect → openclaw agent   │
└────────────┬────────────────────────┘
             │ OpenSandbox SDK
┌────────────▼────────────────────────┐
│ Sandbox Container                   │
│  entrypoint.sh (gateway + collector)│
│    ├── openclaw gateway --raw-stream│
│    │    → /data/raw-stream.jsonl    │
│    └── collect_logs.py              │
│         → /data/agent_logs/*.json   │
└─────────────────────────────────────┘
```

## License

MIT

# Sentrix

Sandboxed [OpenClaw](https://github.com/openclaw/openclaw) with automatic LLM API call log capture.

Sentrix spins up an [OpenSandbox](https://github.com/alibaba/OpenSandbox) container running OpenClaw, captures every raw LLM API response (including reasoning/thinking tokens), and writes them to timestamped JSON files that rotate every 10 minutes.

## Prerequisites

- **Python 3.10+**
- **Docker** (running)
- **opensandbox-server** (`pip install opensandbox-server`)

## Install

```bash
cd sentrix
pip install -e .
```

Use a virtual environment and install from the project directory so all dependencies (including `langgraph` for patrol and police) are installed. A global `pip install sentrix` may miss dependencies required for `sentrix run --patrol` and `sentrix police investigate`.

## Quick Start

```bash
# Interactive setup — walks you through provider, API key, and model selection
sentrix run
```

The wizard walks you through setup using arrow-key menus:

1. **Provider & API key** -- pick from Anthropic, OpenAI, Google, OpenRouter, xAI, Mistral, Groq, Together AI (auto-detects keys already in your environment)
2. **Model** -- choose a model for your provider
3. **Reasoning** -- set thinking depth (adaptive / high / low / off) and toggle reasoning capture
4. **Channels** -- connect Telegram, Discord, Slack, WhatsApp, or Signal
5. **Security** -- confirms secure defaults (exec denied, all agents sandboxed, pairing required)

Then it builds the sandbox image (first run only), starts the gateway and log collector in the sandbox, runs channel login (e.g. WhatsApp QR) once the gateway is healthy, and begins syncing logs. Keep `sentrix run` running in one terminal; in another, run `sentrix chat` to talk to the agent in the terminal (agent runs inside the sandbox, so config and logs stay there).

## CLI Usage

```
sentrix run [OPTIONS]     Start sandbox (gateway + logs); run until Ctrl+C
sentrix chat [OPTIONS]    Attach to running sandbox and run the agent in the terminal
sentrix build [OPTIONS]   Build the sandbox Docker image
sentrix logs [OPTIONS]    View captured log files
sentrix stop              Stop running containers (best-effort)
```

### `sentrix run`

| Flag | Default | Description |
|------|---------|-------------|
| `--log-dir PATH` | `./agent_logs` | Host directory for JSON log files |
| `--rotate-mins N` | `10` | Log rotation interval in minutes |
| `--reasoning / --no-reasoning` | `on` | Capture reasoning/thinking tokens |
| `--port N` | `18789` | Gateway port |
| `--timeout N` | `60` | Sandbox timeout in minutes |
| `-e KEY=VALUE` | | Extra env vars (repeatable) |
| `--image TAG` | `sentrix-openclaw:latest` | Override sandbox image |
| `--verbose` | | Verbose output |
| `--patrol` | | Run patrol swarm: review agent logs, flag malicious content (PII, harmful intent, unsafe tool use) to console and `patrol_flags.jsonl`; requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` |

#### Patrol swarm (`--patrol`)

With `sentrix run --patrol`, a safety patrol runs in the background. It reads synced agent logs from `log_dir`, runs a LangGraph-based patrol (scaling `N = ceil(1 + log2(n))` agents for `n` log streams), and writes any flags to the console and to `log_dir/patrol_flags.jsonl`. Cleared state is stored in `log_dir/patrol_state.db` (SQLite, WAL mode); re-review happens only when `PATROL_RULESET_VERSION` or `PATROL_MODEL_VERSION` change.

| Env var | Description |
|---------|-------------|
| `OPENAI_API_KEY` or `PATROL_OPENAI_API_KEY` | API key for patrol LLM (OpenAI preferred if set) |
| `ANTHROPIC_API_KEY` or `PATROL_ANTHROPIC_API_KEY` | API key for patrol LLM (used if OpenAI not set) |
| `PATROL_MODEL` | Model name (e.g. `gpt-4o-mini`, `claude-3-5-haiku-20241022`) |
| `PATROL_RULESET_VERSION` | Version string for safety rules; bump to re-review all logs |
| `PATROL_MODEL_VERSION` | Model version string; bump when changing patrol model |
| `PATROL_CONFIDENCE_THRESHOLD` | Min confidence to emit a flag (default `0.6`) |
| `PATROL_MAX_TOKENS` | Max tokens per patrol LLM call (default `2048`) |

### `sentrix chat`

Attach to a sandbox started by `sentrix run` and run the OpenClaw agent. The agent runs inside the sandbox (same config, gateway, and log capture). Reads the sandbox ID from `<log-dir>/.sentrix_sandbox_id`.

| Flag | Default | Description |
|------|---------|-------------|
| `--dir PATH` | `./agent_logs` | Log directory (must match the one used by `sentrix run`) |
| `--message`, `-m TEXT` | | Send a single message and exit (non-interactive) |

Without `--message`, runs an interactive loop: type a message and press Enter to get a response; empty line or Ctrl+D to exit.

### Non-interactive mode

Skip the wizard by passing API keys directly:

```bash
sentrix run -e ANTHROPIC_API_KEY=sk-ant-... -e OPENCLAW_DEFAULT_MODEL=anthropic/claude-sonnet-4-6
```

### View logs

```bash
# List all captured log files
sentrix logs

# Show last 5 entries from the most recent file
sentrix logs --tail 5
```

## How It Works

**Single-phase entrypoint:** The container starts the gateway and log collector immediately (no sentinel file). The host waits for the gateway to be healthy, then runs channel login (e.g. WhatsApp QR in the terminal), prints the gateway URL, and starts the log sync loop.

```
┌─────────────────────────────────────┐
│ Host                                │
│  sentrix run                        │
│    ├── opensandbox-server           │
│    ├── create sandbox → health check│
│    ├── channel login (stream QR)    │
│    ├── log sync (periodic pull)     │
│    └── ./agent_logs/*.json          │
│  sentrix chat (other terminal)      │
│    └── reconnect → openclaw agent   │
└────────────┬────────────────────────┘
             │ OpenSandbox SDK
┌────────────▼────────────────────────┐
│ Sandbox Container                   │
│  entrypoint.sh (gateway + collector) │
│    ├── openclaw gateway --raw-stream │
│    │    → /data/raw-stream.jsonl     │
│    └── collect_logs.py               │
│         → /data/agent_logs/*.json    │
└─────────────────────────────────────┘
```

1. The entrypoint starts the gateway and collector in the background and waits on either process.
2. The host polls until the gateway responds, then injects channel config and runs `openclaw channels login` (stdout streamed so you see the QR code).
3. OpenClaw writes every API response to a JSONL file; `collect_logs.py` rotates them into timestamped JSON files.
4. The host sync loop pulls log files to your local `agent_logs/` directory. The **active** (currently written) file is synced every poll cycle (~30s) so agent output and thinking from `sentrix chat` appear on the host shortly after each turn. Closed files (after each 10‑min rotation) are synced once and kept. The sandbox ID is written to `agent_logs/.sentrix_sandbox_id` so `sentrix chat` can reconnect and run the agent in the sandbox.

### Robustness

- **Partial-line safe**: The log collector buffers incomplete JSONL writes until the newline arrives
- **Memory-safe**: JSON objects are streamed to disk immediately (no in-memory buffering)
- **Fail-fast**: If either OpenClaw or the collector crashes, the container exits immediately (`wait -n`)
- **Clean shutdown**: SIGTERM flushes and closes the active JSON file before exit

## Security Defaults

Sentrix applies high-security defaults out of the box:

| Setting | Value | Meaning |
|---------|-------|---------|
| Shell/exec access | `deny` | Agent cannot run shell commands |
| Filesystem | `workspace only` | Read/write restricted to workspace |
| Sandboxing | `all` | Every agent runs in a sandbox container |
| DM policy | `pairing` | Unknown senders must be approved by operator |

These are set via environment variables passed to OpenClaw. You can relax them later by editing `~/.openclaw/openclaw.json` inside the sandbox or by passing `-e` overrides.

## Log Format

Each JSON file contains an array of raw API events:

```json
[
  {"timestamp": "2026-03-09T14:10:01.234Z", "provider": "anthropic", "model": "claude-sonnet-4-6", ...}
,
  {"timestamp": "2026-03-09T14:10:05.678Z", "provider": "anthropic", "model": "claude-sonnet-4-6", ...}
]
```

## License

MIT

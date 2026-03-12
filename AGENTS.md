# OpenClaw Sentrix — Project Overview

This is a multi-component repository containing the **Sentrix** ecosystem for AI agent safety and monitoring, along with the upstream **OpenClaw** personal AI assistant.

## Repository Structure

```
/
├── openclaw/          # Personal AI assistant (Node.js/TypeScript)
├── sentrix/           # Agentic police for OpenClaw (Python)
├── openclaw_sentrix/  # Landing page + Web UI (Next.js/React)
├── deprecated_sentrix/# Legacy version (not maintained)
└── oc_test/           # Test directory
```

---

## Component 1: OpenClaw (`openclaw/`)

A personal AI assistant that runs on your own devices and answers on messaging channels you already use.

### Technology Stack
- **Runtime**: Node.js ≥22.12.0
- **Language**: TypeScript (ES modules)
- **Package Manager**: pnpm 10.23.0 (primary), Bun (optional for dev)
- **Build Tool**: tsdown + custom scripts
- **Testing**: Vitest with V8 coverage
- **Linting/Formatting**: Oxlint + Oxfmt
- **Native Apps**: Swift (iOS/macOS), Kotlin (Android)

### Supported Channels
WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, BlueBubbles, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, WebChat.

### Key Configuration Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `pyproject.toml` - Python tooling (Ruff, pytest)
- `vitest.config.ts` - Test configuration
- `docker-compose.yml` - Docker setup
- `fly.toml` / `render.yaml` - Deployment configs

### Build Commands
```bash
cd openclaw
pnpm install        # Install dependencies
pnpm build          # Full production build
pnpm dev            # Development mode
pnpm check          # Lint + format + type check
pnpm test           # Run tests
pnpm test:coverage  # Run tests with coverage
```

### Source Organization
- `src/` - Main source code
  - `agents/` - AI agent runtime, model handling, tools
  - `cli/` - Command-line interface
  - `commands/` - CLI command implementations
  - `gateway/` - Gateway server implementation
  - `channels/` - Messaging channel integrations
  - `discord/`, `telegram/`, `slack/`, `signal/`, `imessage/` - Channel-specific code
  - `auto-reply/` - Auto-reply and message handling
  - `browser/` - Browser automation
  - `config/` - Configuration management
  - `infra/` - Infrastructure utilities
- `extensions/` - Plugin packages
- `skills/` - Agent skills (Python + TypeScript)
- `apps/` - Native applications (iOS, Android, macOS)
- `docs/` - Documentation (Mintlify)
- `scripts/` - Build and utility scripts
- `test/` - Test fixtures and helpers

### Development Conventions
- All source code in `src/` uses TypeScript with strict typing
- Tests are colocated as `*.test.ts` files
- Use `pnpm` for all package operations
- Run `pnpm check` before commits
- Follow the existing code style enforced by Oxlint/Oxfmt
- Keep files under ~700 LOC; split when necessary
- For plugins, avoid `workspace:*` in dependencies

---

## Component 2: Sentrix (`sentrix/`)

Agentic police for OpenClaw — uses AI agents to watch AI agents. A patrol swarm continuously monitors OpenClaw instances for safety issues.

### Technology Stack
- **Language**: Python 3.10+
- **Package Manager**: uv (with `uv.lock`)
- **Build**: Hatchling
- **Framework**: LangGraph for agent orchestration
- **Key Libraries**: 
  - `opensandbox`, `opensandbox-server` - Sandboxed execution
  - `langchain-core`, `langchain-openai`, `langchain-anthropic` - LLM integration
  - `click` - CLI framework
  - `rich`, `questionary` - Terminal UI
  - `websockets` - WSS bridge
  - `pydantic` ≥2 - Data validation

### Key Configuration Files
- `pyproject.toml` - Project metadata, dependencies, tool config
- `requirements.txt` - Alternative dependency listing
- `uv.lock` - Locked dependency versions
- `.env` / `.env.example` - Environment configuration

### Installation
```bash
cd sentrix
pip install openclaw-sentrix
# or from source:
pip install -e .
```

### CLI Commands
```bash
sentrix run [OPTIONS]       # Start sandbox + patrol + bridge
sentrix chat [OPTIONS]      # Attach to running sandbox
sentrix bridge [OPTIONS]    # Run WSS bridge only
sentrix build [OPTIONS]     # Build sandbox Docker image
sentrix logs [OPTIONS]      # View captured API call logs
sentrix stop                # Stop running containers
sentrix police              # View case files and patrol flags
sentrix police investigate <FLAG_ID>  # Run investigation
```

### Source Organization
- `sentrix/` - Main package
  - `cli.py` - CLI entry point
  - `sandbox.py` - Docker sandbox management
  - `bridge.py` - WebSocket bridge for web UI
  - `log_sync.py` - Log synchronization from sandbox
  - `wizard.py` - Interactive setup wizard
  - `config.py` - Configuration management
  - `patrol/` - Patrol swarm (LangGraph)
    - `graph.py` - Patrol graph orchestration
    - `agents/log_patrol.py` - Individual patrol agents
    - `orchestrator.py` - Work assignment
    - `blackboard.py` - Pheromone-based coordination
    - `models.py` - Data models
  - `police/` - Police investigator
    - `graph.py` - Investigation graph
    - `agents/investigator.py` - Lead investigator agent
    - `db.py` - SQLite database for case files
    - `escalation.py` - Escalation queue
    - `models.py` - Data models
  - `sandbox/` - Sandbox utilities

### Data Storage
- `agent_logs/` - Captured LLM API call logs
- `agent_logs/patrol_flags.jsonl` - Patrol flag output
- `agent_logs/police.db` - Case file database
- `agent_logs/reports/` - Generated case file JSONs

### Environment Variables
```bash
# LLM API Keys (for patrol)
OPENAI_API_KEY
ANTHROPIC_API_KEY
PATROL_MODEL                 # Model name (e.g., gpt-4o-mini)
PATROL_CONFIDENCE_THRESHOLD  # Default: 0.6
PATROL_RULESET_VERSION       # Bump to re-review logs
PATROL_MODEL_VERSION         # Bump when changing model
```

---

## Component 3: OpenClaw Sentrix Web (`openclaw_sentrix/`)

Landing page for Sentrix with a pixel-art style and a "Your Claw" chat interface.

### Technology Stack
- **Framework**: Next.js 16.1.6
- **Language**: TypeScript
- **UI**: React 19.2.3, Tailwind CSS v4
- **Animation**: Framer Motion, Lenis (smooth scroll)
- **Graphics**: Pixi.js 8.16.0 + @pixi/react for sprite rendering
- **Icons**: Lucide React
- **Database**: Supabase (waitlist)

### Key Configuration Files
- `package.json` - Dependencies
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `postcss.config.mjs` - PostCSS/Tailwind config
- `eslint.config.mjs` - ESLint configuration
- `supabase-waitlist.sql` - Database schema

### Build Commands
```bash
cd openclaw_sentrix
npm install         # Install dependencies
npm run dev         # Development server (localhost:3000)
npm run build       # Production build
npm run start       # Start production server
npm run lint        # Run ESLint
```

### Source Organization
- `app/` - Next.js app directory
  - `page.tsx` - Landing page
  - `layout.tsx` - Root layout
  - `claw/page.tsx` - "Your Claw" chat interface
  - `components/` - React components
    - `Hero.tsx`, `Problem.tsx`, `Solution.tsx`, `Tech.tsx` - Landing sections
    - `AgentPolice/` - Pixi.js sprite world components
      - `SpriteWorld.tsx` - Main game world
      - `entities/` - Agent sprites (Patrol, Investigator)
      - `layers/` - Rendering layers (floor, entities, effects)
    - `WaitlistForm.tsx` - Supabase waitlist
    - `SmoothScroll.tsx` - Lenis integration
- `lib/` - Utility functions
- `public/` - Static assets

### Connecting to Local Sandbox
The "Your Claw" tab connects to a local WSS bridge:
1. Start Sentrix: `sentrix run` (bridge runs on port 8766)
2. Open the app → "Your Claw"
3. Set Bridge URL to `wss://localhost:8766`

First-time cert trust: Open `https://localhost:8765` and `https://localhost:8766` in your browser to accept the self-signed certificate.

---

## Cross-Component Development

### Running Full Stack Locally
```bash
# Terminal 1: Start OpenClaw gateway
cd openclaw
pnpm gateway:dev

# Terminal 2: Start Sentrix with patrol
cd sentrix
sentrix run --patrol

# Terminal 3: Start web UI
cd openclaw_sentrix
npm run dev
```

### Testing
- **OpenClaw**: `pnpm test` (Vitest)
- **Sentrix**: Add tests to `tests/` directory; run via pytest
- **Web**: Manual testing via browser; connect to local bridge

### Security Considerations
- Sentrix runs OpenClaw in a Docker sandbox with restricted filesystem access
- Default security: shell/exec denied, workspace-only filesystem, all agents sandboxed
- DM policy requires pairing for unknown senders
- Never commit real API keys, phone numbers, or credentials
- Use `.env` files for local secrets (already in `.gitignore`)

### Code Style Guidelines

**TypeScript (OpenClaw + Web):**
- Prefer strict typing; avoid `any`
- Use ESM imports
- Run `pnpm check` before commits
- Follow existing patterns for CLI options and DI

**Python (Sentrix):**
- Follow PEP 8
- Use type hints where practical
- Use `rich` for terminal output
- Prefer `pathlib` over `os.path`

---

## Release Channels

### OpenClaw
- **stable**: Tagged releases (`vYYYY.M.D`), npm dist-tag `latest`
- **beta**: Prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta`
- **dev**: Moving head of `main`

### Sentrix
- Published to PyPI as `openclaw-sentrix`
- Version in `pyproject.toml`

### Web
- Deployed to Vercel
- Production: `https://openclaw-sentrix.vercel.app`

---

## Additional Resources

- **OpenClaw Docs**: https://docs.openclaw.ai
- **OpenClaw GitHub**: https://github.com/openclaw/openclaw
- **Sentrix README**: `sentrix/README.md`
- **OpenClaw AGENTS.md**: `openclaw/AGENTS.md` (detailed conventions)

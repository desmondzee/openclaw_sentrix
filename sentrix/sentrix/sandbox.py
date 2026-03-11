"""OpenSandbox SDK integration: create, start, sync, and stop sandboxes."""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

from opensandbox import Sandbox
from opensandbox.config import ConnectionConfig
from opensandbox.models.execd import ExecutionHandlers

from sentrix.config import (
    SentrixConfig,
    resolve_opensandbox_server,
)
from sentrix.log_sync import final_sync, run_sync_loop

SERVER_READY_TIMEOUT = 30  # seconds to wait for opensandbox-server
SERVER_POLL_INTERVAL = 1.0
GATEWAY_READY_TIMEOUT = 60
GATEWAY_POLL_INTERVAL = 2.0


def _find_server_bin() -> str:
    """Locate opensandbox-server or exit with install instructions."""
    server_bin = resolve_opensandbox_server()
    if not shutil.which(server_bin):
        print(
            "[sentrix] opensandbox-server not found. Install with:\n"
            "  uv pip install opensandbox-server\n"
            "  # or: pip install opensandbox-server\n",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return server_bin


def _init_server_config(server_bin: str) -> None:
    """Initialize opensandbox-server config if it doesn't exist."""
    config_path = Path.home() / ".sandbox.toml"
    if config_path.exists():
        return

    print("[sentrix] initializing opensandbox-server config...")
    result = subprocess.run(
        [server_bin, "init-config", str(config_path), "--example", "docker"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(f"[sentrix] warning: init-config failed: {result.stderr.strip()}", file=sys.stderr)


async def _server_is_healthy() -> bool:
    """Check if opensandbox-server is reachable."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://127.0.0.1:8080/health")
            return resp.status_code == 200
    except Exception:
        return False


async def ensure_server_running() -> subprocess.Popen | None:
    """Start opensandbox-server in the background if not already running."""
    if await _server_is_healthy():
        print("[sentrix] opensandbox-server already running.")
        return None

    server_bin = _find_server_bin()
    _init_server_config(server_bin)

    print("[sentrix] starting opensandbox-server...")
    server_proc = subprocess.Popen(
        [server_bin],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    elapsed = 0.0
    while elapsed < SERVER_READY_TIMEOUT:
        if server_proc.poll() is not None:
            stderr = server_proc.stderr.read().decode() if server_proc.stderr else ""
            print(f"[sentrix] opensandbox-server exited unexpectedly (code {server_proc.returncode})", file=sys.stderr)
            if stderr.strip():
                print(f"  {stderr.strip()}", file=sys.stderr)
            raise SystemExit(1)

        if await _server_is_healthy():
            print("[sentrix] opensandbox-server ready.")
            return server_proc

        await asyncio.sleep(SERVER_POLL_INTERVAL)
        elapsed += SERVER_POLL_INTERVAL

    print(
        f"[sentrix] opensandbox-server did not become ready within {SERVER_READY_TIMEOUT}s.\n"
        "  Try running it manually: opensandbox-server",
        file=sys.stderr,
    )
    server_proc.terminate()
    raise SystemExit(1)


def build_image(config: SentrixConfig) -> None:
    """Build the sentrix sandbox Docker image."""
    dockerfile_dir = config.dockerfile_dir
    if not dockerfile_dir.exists():
        print(f"[sentrix] sandbox/ directory not found at {dockerfile_dir}", file=sys.stderr)
        raise SystemExit(1)

    docker_bin = shutil.which("docker")
    if not docker_bin:
        print("[sentrix] docker not found on PATH", file=sys.stderr)
        raise SystemExit(1)

    print(f"[sentrix] building image {config.image}...")
    result = subprocess.run(
        [
            docker_bin, "build",
            "-t", config.image,
            "-f", str(dockerfile_dir / "Dockerfile"),
            str(dockerfile_dir),
        ],
        check=False,
    )
    if result.returncode != 0:
        print("[sentrix] docker build failed", file=sys.stderr)
        raise SystemExit(result.returncode)
    print(f"[sentrix] image {config.image} built successfully")


def image_exists(image: str) -> bool:
    """Check if a Docker image exists locally."""
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return False
    result = subprocess.run(
        [docker_bin, "image", "inspect", image],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


async def create_sandbox(config: SentrixConfig) -> Sandbox:
    """Create an OpenSandbox sandbox with the sentrix image."""
    conn = ConnectionConfig(use_server_proxy=True)
    sandbox = await Sandbox.create(
        config.image,
        entrypoint=["/opt/sentrix/entrypoint.sh"],
        env=config.sandbox_env(),
        timeout=timedelta(minutes=config.timeout_mins),
        connection_config=conn,
    )
    return sandbox


# Minimal channel config so OpenClaw CLI recognizes the channel (docs: configure then login).
# See https://docs.openclaw.ai/channels/whatsapp
_CHANNEL_CONFIG_DEFAULTS: dict[str, dict] = {
    "whatsapp": {"dmPolicy": "pairing", "allowFrom": []},
    "telegram": {},  # botToken can be set later via env or config
}


async def _inject_channel_config(sandbox: Sandbox, channels: list[str]) -> None:
    """Inject selected channels into sandbox openclaw.json so `openclaw channels login` recognizes them."""
    if not channels:
        return
    config_path = "/home/node/.openclaw/openclaw.json"
    # Build defaults object and channel list in Node; we only inject channel IDs (no JSON escaping).
    defaults_js = json.dumps(_CHANNEL_CONFIG_DEFAULTS)
    channels_js = json.dumps(channels)
    script = (
        "const fs=require('fs');const p=%s;const defaults=%s;const channelIds=%s;"
        "let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){}"
        "c.channels=c.channels||{};"
        "channelIds.forEach(id=>{c.channels[id]=Object.assign({},defaults[id]||{},c.channels[id]||{});});"
        "fs.writeFileSync(p,JSON.stringify(c,null,2));"
    ) % (repr(config_path), defaults_js, channels_js)
    result = await sandbox.commands.run(f"node -e {repr(script)}")
    exit_code = getattr(result, "exit_code", 0)
    if exit_code != 0:
        stderr_text = ""
        stdout_text = ""
        if hasattr(result, "logs"):
            if result.logs.stderr:
                stderr_text = "\n".join(
                    getattr(m, "text", str(m)) for m in result.logs.stderr
                )
            if result.logs.stdout:
                stdout_text = "\n".join(
                    getattr(m, "text", str(m)) for m in result.logs.stdout
                )
        print(
            f"[sentrix] warning: failed to inject channel config (exit {exit_code})",
            file=sys.stderr,
        )
        if stderr_text.strip():
            print(f"  stderr: {stderr_text.strip()}", file=sys.stderr)
        if stdout_text.strip():
            print(f"  stdout: {stdout_text.strip()}", file=sys.stderr)


async def _verify_channel_config(sandbox: Sandbox, channels: list[str]) -> None:
    """Read back openclaw.json and confirm requested channels are present."""
    config_path = "/home/node/.openclaw/openclaw.json"
    result = await sandbox.commands.run(f"cat {config_path}")
    raw = ""
    if hasattr(result, "logs") and result.logs.stdout:
        raw = "\n".join(getattr(m, "text", str(m)) for m in result.logs.stdout)
    try:
        cfg = json.loads(raw)
        configured = set(cfg.get("channels", {}).keys())
        for ch in channels:
            if ch in configured:
                print(f"[sentrix] ✓ channel '{ch}' present in sandbox config")
            else:
                print(
                    f"[sentrix] ✗ channel '{ch}' missing from sandbox config — login may fail",
                    file=sys.stderr,
                )
    except (json.JSONDecodeError, AttributeError):
        print(
            f"[sentrix] warning: could not read sandbox openclaw.json for verification",
            file=sys.stderr,
        )


async def _run_channel_logins(sandbox: Sandbox, channels: list[str]) -> None:
    """Run `openclaw channels login` for each interactive channel, streaming output."""
    await _inject_channel_config(sandbox, channels)
    await _verify_channel_config(sandbox, channels)

    # Detect host terminal width so the QR code renders at the correct size
    import shutil
    host_columns = shutil.get_terminal_size().columns

    for ch in channels:
        print(f"\n[sentrix] linking {ch} (scan QR code when it appears)...")

        async def _on_stdout(msg: object) -> None:
            text = getattr(msg, "text", str(msg))
            # Ensure each message ends with a newline so QR code lines
            # don't get concatenated into one unbroken string.
            if not text.endswith("\n"):
                text += "\n"
            print(text, end="", flush=True)

        async def _on_stderr(msg: object) -> None:
            text = getattr(msg, "text", str(msg))
            if not text.endswith("\n"):
                text += "\n"
            print(text, end="", flush=True)

        # Set COLUMNS + TERM so the QR code library knows the terminal width
        # and renders the QR at the correct, scannable size.
        result = await sandbox.commands.run(
            f"COLUMNS={host_columns} TERM=xterm-256color "
            f"openclaw channels login --channel {ch}",
            handlers=ExecutionHandlers(
                on_stdout=_on_stdout,
                on_stderr=_on_stderr,
            ),
        )
        exit_code = result.exit_code if hasattr(result, "exit_code") else 0
        if exit_code != 0:
            print(f"\n[sentrix] warning: {ch} login exited with code {exit_code}")
        else:
            print(f"\n[sentrix] {ch} linked successfully!")


async def _wait_for_gateway(
    sandbox: Sandbox, port: int, timeout: float = GATEWAY_READY_TIMEOUT
) -> None:
    """Poll gateway health inside the sandbox until it responds."""
    elapsed = 0.0
    while elapsed < timeout:
        try:
            result = await sandbox.commands.run(
                f"curl -sf http://127.0.0.1:{port}/__openclaw__/ -o /dev/null -w '%{{http_code}}'",
            )
            stdout = ""
            if result.logs.stdout:
                stdout = result.logs.stdout[0].text.strip()
            if stdout in ("200", "401"):
                print("[sentrix] gateway is ready.")
                return
        except Exception:
            pass
        await asyncio.sleep(GATEWAY_POLL_INTERVAL)
        elapsed += GATEWAY_POLL_INTERVAL

    print("[sentrix] warning: gateway did not become ready in time, continuing anyway...")


SANDBOX_ID_FILENAME = ".sentrix_sandbox_id"


def _write_sandbox_id(log_dir: Path, sandbox_id: str) -> Path:
    """Write sandbox ID to log_dir so sentrix chat can reconnect."""
    path = log_dir / SANDBOX_ID_FILENAME
    path.write_text(sandbox_id, encoding="utf-8")
    return path


def read_sandbox_id(log_dir: Path) -> str | None:
    """Read sandbox ID from log_dir. Returns None if missing or empty."""
    path = log_dir / SANDBOX_ID_FILENAME
    if not path.exists():
        return None
    raw = path.read_text(encoding="utf-8").strip()
    return raw or None


async def connect_sandbox(sandbox_id: str) -> Sandbox:
    """Reconnect to an existing sandbox by ID (e.g. for sentrix chat)."""
    conn = ConnectionConfig(use_server_proxy=True)
    return await Sandbox.connect(
        sandbox_id,
        connection_config=conn,
    )


async def get_direct_endpoint(sandbox: Sandbox, port: int) -> str:
    """Get direct endpoint URL bypassing opensandbox-server proxy.

    The server proxy doesn't support WebSocket upgrade (OpenSandbox #383),
    so WebSocket connections must use the direct Docker-mapped endpoint.
    """
    endpoint = await sandbox._sandbox_service.get_sandbox_endpoint(
        sandbox.id, port, use_server_proxy=False
    )
    return endpoint.endpoint


async def run_agent_in_sandbox(
    sandbox: Sandbox,
    message: str | None = None,
) -> int:
    """Run openclaw agent in the sandbox with streaming stdout/stderr. Returns exit code."""
    async def _on_stdout(msg: object) -> None:
        text = getattr(msg, "text", str(msg))
        print(text, end="", flush=True)

    async def _on_stderr(msg: object) -> None:
        text = getattr(msg, "text", str(msg))
        print(text, end="", flush=True)

    # Target the default main session (required by openclaw agent CLI)
    cmd = "openclaw agent --agent main"
    if message:
        # Escape for shell: wrap in single quotes, escape single quotes as '\''
        escaped = message.replace("'", "'\"'\"'")
        cmd = f"openclaw agent --agent main --message '{escaped}'"

    result = await sandbox.commands.run(
        cmd,
        handlers=ExecutionHandlers(
            on_stdout=_on_stdout,
            on_stderr=_on_stderr,
        ),
    )
    return result.exit_code if hasattr(result, "exit_code") else 0


async def run_sandbox(
    config: SentrixConfig,
    *,
    patrol: bool = False,
    escalation_level: str | None = None,
) -> None:
    """Full lifecycle: create sandbox, health check, channel logins, log sync, then idle. If patrol=True, run patrol loop in background. If escalation_level is set, auto-invoke investigator on qualifying flags (priority queue: HIGH > MEDIUM > LOW)."""
    log_dir = config.ensure_log_dir()

    server_proc = await ensure_server_running()

    if not image_exists(config.image):
        build_image(config)

    print(f"[sentrix] creating sandbox (image={config.image})...")
    try:
        sandbox = await create_sandbox(config)
    except Exception as exc:
        print(f"[sentrix] failed to create sandbox: {exc}", file=sys.stderr)
        print(
            "\n  Troubleshooting:\n"
            "  1. Is Docker running? Check with: docker info\n"
            "  2. Is opensandbox-server healthy? Check: curl http://127.0.0.1:8080/health\n"
            "  3. Try running the server manually: opensandbox-server\n",
            file=sys.stderr,
        )
        if server_proc:
            server_proc.terminate()
        raise SystemExit(1)

    print(f"[sentrix] sandbox created (id={sandbox.id})")

    # Wait for gateway to be healthy (entrypoint starts gateway + collector immediately)
    await _wait_for_gateway(sandbox, config.port)

    # Channel login after gateway is up (stream stdout so user sees QR code)
    if config.interactive_channels:
        await _run_channel_logins(sandbox, config.interactive_channels)

    # Print gateway endpoint for reference
    try:
        endpoint = await sandbox.get_endpoint(config.port)
        print(f"[sentrix] gateway at http://{endpoint.endpoint}")
    except Exception:
        pass

    # Persist sandbox ID so sentrix chat can reconnect
    _write_sandbox_id(log_dir, sandbox.id)

    # Start the log sync loop
    stop_event = asyncio.Event()
    sync_task = asyncio.create_task(
        run_sync_loop(sandbox, log_dir, config.rotate_mins, stop_event=stop_event)
    )

    patrol_task = None
    investigator_task = None
    if patrol:
        from sentrix.patrol.sweep import run_patrol_loop

        flags_path = log_dir / "patrol_flags.jsonl"
        inv_queue: asyncio.Queue[tuple] = asyncio.Queue()

        def _on_flags(flags: list) -> None:
            if escalation_level and flags:
                from sentrix.police.escalation import enqueue_flags_for_investigation
                enqueue_flags_for_investigation(flags, escalation_level, log_dir, inv_queue)

        async def _patrol_loop() -> None:
            try:
                await run_patrol_loop(
                    log_dir,
                    poll_secs=30.0,
                    flags_path=flags_path,
                    on_flags=_on_flags,
                )
            except asyncio.CancelledError:
                pass

        patrol_task = asyncio.create_task(_patrol_loop())
        print("[sentrix] patrol swarm started (flags → patrol_flags.jsonl)")

        if escalation_level:
            from sentrix.police.escalation import run_investigation_consumer
            investigator_task = asyncio.create_task(
                run_investigation_consumer(log_dir, inv_queue, escalation_level)
            )
            print("[sentrix] investigator auto-escalation started (queue by severity)")

    print("[sentrix] running. Press Ctrl+C to stop. Use 'sentrix chat' in another terminal to talk to the agent.\n")

    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        print("\n[sentrix] shutting down...")
        stop_event.set()

        if investigator_task:
            investigator_task.cancel()
            try:
                await investigator_task
            except asyncio.CancelledError:
                pass
        if patrol_task:
            patrol_task.cancel()
            try:
                await patrol_task
            except asyncio.CancelledError:
                pass

        try:
            pulled = await final_sync(sandbox, log_dir, config.rotate_mins)
            if pulled:
                for f in pulled:
                    print(f"[sentrix] final sync: {f}")
        except Exception as exc:
            print(f"[sentrix] final sync error: {exc}", file=sys.stderr)

        sync_task.cancel()
        try:
            await sync_task
        except asyncio.CancelledError:
            pass

        try:
            await sandbox.kill()
            print("[sentrix] sandbox stopped")
        except Exception:
            pass

        # Clear sandbox ID so sentrix chat does not reconnect to a dead sandbox
        id_file = log_dir / SANDBOX_ID_FILENAME
        if id_file.exists():
            try:
                id_file.unlink()
            except OSError:
                pass

        if server_proc:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()

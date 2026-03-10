"""Sentrix CLI – sandboxed OpenClaw with API log capture."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

# Load .env from cwd (and parent dirs) so OPENAI_API_KEY etc. are available without exporting
load_dotenv()

from sentrix.config import (
    GATEWAY_PORT,
    ROTATE_MINS,
    SANDBOX_IMAGE,
    SANDBOX_TIMEOUT_MINS,
    SentrixConfig,
)
from sentrix.sandbox import (
    connect_sandbox,
    read_sandbox_id,
    run_agent_in_sandbox,
)

console = Console()


def _parse_env_pairs(pairs: tuple[str, ...]) -> dict[str, str]:
    """Parse KEY=VALUE pairs into a dict."""
    env: dict[str, str] = {}
    for pair in pairs:
        if "=" not in pair:
            click.echo(f"Invalid env format (expected KEY=VALUE): {pair}", err=True)
            raise SystemExit(1)
        key, _, value = pair.partition("=")
        env[key] = value
    return env


@click.group()
@click.version_option(package_name="sentrix")
def main() -> None:
    """Sentrix – sandboxed OpenClaw with API log capture."""


@main.command()
@click.option("--log-dir", default="./agent_logs", type=click.Path(), help="Host directory for JSON logs.")
@click.option("--rotate-mins", default=ROTATE_MINS, type=int, help="Log rotation interval in minutes.")
@click.option("--reasoning/--no-reasoning", default=None, help="Enable reasoning/thinking capture.")
@click.option("--port", default=GATEWAY_PORT, type=int, help="Gateway port.")
@click.option("--timeout", "timeout_mins", default=SANDBOX_TIMEOUT_MINS, type=int, help="Sandbox timeout in minutes.")
@click.option("-e", "--env", "extra_env", multiple=True, help="Extra env vars (KEY=VALUE), repeatable.")
@click.option("--image", default=SANDBOX_IMAGE, help="Sandbox Docker image.")
@click.option("--verbose", is_flag=True, help="Verbose output.")
@click.option("--patrol", is_flag=True, help="Run patrol swarm: review agent logs, flag malicious content to console and patrol_flags.jsonl.")
@click.option("--escalation", type=click.Choice(["low_above", "medium_above", "high_only"]), default=None, help="When to auto-run investigator on patrol flags (default with --patrol: medium_above).")
def run(
    log_dir: str,
    rotate_mins: int,
    reasoning: bool | None,
    port: int,
    timeout_mins: int,
    extra_env: tuple[str, ...],
    image: str,
    verbose: bool,
    patrol: bool,
    escalation: str | None,
) -> None:
    """Start sandboxed OpenClaw (create, health check, channel login, log sync).

    Runs in the foreground until Ctrl+C. In another terminal run
    'sentrix chat' to attach an interactive agent session. When called
    without -e flags, launches an interactive setup wizard for provider,
    API key, model, and channels. With --patrol, also runs the patrol swarm
    to review agent logs and flag malicious content (requires OPENAI_API_KEY or ANTHROPIC_API_KEY).
    """
    from sentrix.sandbox import run_sandbox

    if patrol:
        from sentrix.patrol.config import PATROL_DEPLOYMENT
        if not PATROL_DEPLOYMENT:
            console.print("[red]Patrol requires OPENAI_API_KEY or ANTHROPIC_API_KEY (or PATROL_* env vars).[/red]")
            raise SystemExit(1)

    parsed_env = _parse_env_pairs(extra_env)

    # If no API key env vars were provided, run the interactive wizard
    has_api_key = any(
        k.endswith("_API_KEY") or k.endswith("_TOKEN") or k == "GEMINI_API_KEY"
        for k in parsed_env
    )

    interactive_channels: list[str] = []

    patrol_enabled_from_wizard = False
    escalation_level_from_wizard: str | None = None

    if not has_api_key:
        from sentrix.wizard import run_setup_wizard
        result = run_setup_wizard()
        wizard_env = result[0]
        interactive_channels = result[1]
        if len(result) >= 4:
            patrol_enabled_from_wizard = result[2]
            escalation_level_from_wizard = result[3]

        if reasoning is None:
            reasoning = wizard_env.pop("OPENCLAW_REASONING", None) == "on"
        else:
            wizard_env.pop("OPENCLAW_REASONING", None)

        parsed_env.update(wizard_env)

    if reasoning is None:
        reasoning = True

    # Patrol: enable if --patrol or wizard selected it; escalation from --escalation, wizard, or env
    patrol = patrol or patrol_enabled_from_wizard
    escalation_level = escalation or escalation_level_from_wizard or parsed_env.get("SENTRIX_ESCALATION")
    if patrol and not escalation_level:
        escalation_level = "medium_above"

    config = SentrixConfig(
        log_dir=Path(log_dir),
        rotate_mins=rotate_mins,
        reasoning=reasoning,
        port=port,
        timeout_mins=timeout_mins,
        image=image,
        verbose=verbose,
        extra_env=parsed_env,
        interactive_channels=interactive_channels,
        patrol_enabled=patrol,
        escalation_level=escalation_level,
    )

    console.print()
    console.print(f"[bold]sentrix[/bold] starting sandbox (image={config.image})")
    console.print(f"  logs → {config.log_dir.resolve()}")
    console.print(f"  rotation every {config.rotate_mins}min | port {config.port}")
    if patrol:
        console.print("  [dim]patrol swarm enabled[/dim]")
        if escalation_level:
            esc_label = {"low_above": "Low+", "medium_above": "Medium+", "high_only": "High only"}.get(escalation_level, escalation_level)
            console.print(f"  [dim]investigator escalation: {esc_label}[/dim]")

    try:
        asyncio.run(run_sandbox(config, patrol=patrol, escalation_level=escalation_level))
    except KeyboardInterrupt:
        pass


@main.command()
@click.option("--dir", "log_dir", default="./agent_logs", type=click.Path(), help="Log directory (where .sentrix_sandbox_id is stored).")
@click.option("--message", "-m", default=None, help="Single message to send (non-interactive). Omit for interactive prompt loop.")
def chat(log_dir: str, message: str | None) -> None:
    """Attach to a running sentrix sandbox and run the OpenClaw agent in the terminal.

    Requires 'sentrix run' to be running in another terminal. Reads the sandbox ID
    from <log_dir>/.sentrix_sandbox_id. Streams agent stdout/stderr to this terminal.
    With --message, sends one message and exits; without it, runs an interactive
    prompt loop (type a message, press Enter, see agent response).
    """
    import asyncio

    log_path = Path(log_dir)
    sandbox_id = read_sandbox_id(log_path)
    if not sandbox_id:
        console.print("[red]No running sandbox found.[/red] Start one with [bold]sentrix run[/bold] in another terminal.")
        raise SystemExit(1)

    async def _chat() -> None:
        try:
            sbx = await connect_sandbox(sandbox_id)
        except Exception as exc:
            console.print(f"[red]Failed to connect to sandbox: {exc}[/red]")
            raise SystemExit(1)

        if message is not None:
            exit_code = await run_agent_in_sandbox(sbx, message=message)
            raise SystemExit(exit_code if exit_code != 0 else 0)

        # Interactive loop: prompt for message, run agent --message "...", stream output
        console.print("[dim]Type a message and press Enter (empty line or Ctrl+D to exit).[/dim]\n")
        try:
            while True:
                try:
                    line = input("You: ").strip()
                except EOFError:
                    break
                if not line:
                    break
                await run_agent_in_sandbox(sbx, message=line)
                console.print()
        except KeyboardInterrupt:
            pass

    asyncio.run(_chat())


@main.command()
@click.option("--log-dir", "log_dir", default="./agent_logs", type=click.Path(), help="Log directory (where .sentrix_sandbox_id is stored).")
@click.option("--port", default=8766, type=int, help="Port for WSS bridge (trust server runs on port - 1).")
@click.option("--host", default="0.0.0.0", help="Host to bind (0.0.0.0 for all interfaces).")
@click.option("--cert", "cert_path", default=None, type=click.Path(), help="Path to TLS certificate (optional).")
@click.option("--key", "key_path", default=None, type=click.Path(), help="Path to TLS key (optional).")
def bridge(
    log_dir: str,
    port: int,
    host: str,
    cert_path: str | None,
    key_path: str | None,
) -> None:
    """Run the WSS bridge for the Web UI (Your Claw).

    Requires 'sentrix run' in another terminal. Listens for wss:// connections,
    validates Origin, and proxies to the OpenClaw Gateway in the sandbox.
    GET /ping returns 200 OK for cert trust (open https://localhost:PORT/ping once if using self-signed).
    """
    from sentrix.bridge import run_bridge

    path = Path(log_dir)
    cert = Path(cert_path) if cert_path else None
    key = Path(key_path) if key_path else None
    run_bridge(log_dir=path, host=host, port=port, cert_path=cert, key_path=key)


@main.command()
@click.option("--image", default=SANDBOX_IMAGE, help="Image tag to build.")
def build(image: str) -> None:
    """Build the sentrix sandbox Docker image."""
    from sentrix.sandbox import build_image

    config = SentrixConfig(image=image)
    build_image(config)


@main.command()
@click.option("--dir", "log_dir", default="./agent_logs", type=click.Path(exists=True), help="Log directory.")
@click.option("--tail", "tail_n", default=0, type=int, help="Show last N entries (0 = show all files).")
def logs(log_dir: str, tail_n: int) -> None:
    """View captured API call log files."""
    log_path = Path(log_dir)
    json_files = sorted(log_path.glob("*.json"))

    if not json_files:
        console.print("[dim]No log files found.[/dim]")
        return

    if tail_n > 0:
        latest = json_files[-1]
        try:
            entries = json.loads(latest.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            console.print(f"[red]Error reading {latest.name}: {exc}[/red]")
            return

        for entry in entries[-tail_n:]:
            console.print_json(data=entry)
    else:
        table = Table(title="Captured Log Files")
        table.add_column("File", style="cyan")
        table.add_column("Size", justify="right")
        table.add_column("Entries", justify="right")

        for f in json_files:
            size = f.stat().st_size
            try:
                entries = json.loads(f.read_text(encoding="utf-8"))
                count = str(len(entries))
            except (json.JSONDecodeError, OSError):
                count = "?"
            size_str = f"{size / 1024:.1f} KB" if size >= 1024 else f"{size} B"
            table.add_row(f.name, size_str, count)

        console.print(table)


@main.group(invoke_without_command=True)
@click.option("--dir", "log_dir", default="./agent_logs", type=click.Path(exists=False), help="Agent logs directory (for DB and patrol_flags.jsonl).")
@click.option("--cases", "show_cases", is_flag=True, help="List case files from police DB.")
@click.option("--clogs", "show_clogs", is_flag=True, help="Alias for --cases.")
@click.option("--plogs", "show_plogs", is_flag=True, help="Tail patrol flags from patrol_flags.jsonl.")
@click.option("--limit", default=50, type=int, help="Max entries to show (default 50).")
@click.pass_context
def police(ctx: click.Context, log_dir: str, show_cases: bool, show_clogs: bool, show_plogs: bool, limit: int) -> None:
    """View case files and patrol flags, or run an investigation."""
    ctx.ensure_object(dict)
    log_path = Path(log_dir)
    ctx.obj["log_dir"] = log_path
    if ctx.invoked_subcommand is not None:
        return
    # No subcommand: show cases and/or plogs
    show_cases = show_cases or show_clogs
    if not show_cases and not show_plogs:
        show_cases = True
        show_plogs = True
        limit = 5

    if show_cases:
        from sentrix.police.config import police_db_path
        from sentrix.police.db import open_police_db, list_case_files
        db_path = police_db_path(log_path)
        if not db_path.exists():
            console.print("[dim]No police DB found. Run an investigation first.[/dim]")
        else:
            conn = open_police_db(db_path)
            rows = list_case_files(conn, limit=limit)
            conn.close()
            if not rows:
                console.print("[dim]No case files yet.[/dim]")
            else:
                table = Table(title="Case files (most recent)")
                table.add_column("Time", style="dim")
                table.add_column("Investigation ID", style="cyan")
                table.add_column("Source", style="green")
                table.add_column("Crime", style="yellow")
                table.add_column("Severity")
                table.add_column("Summary", max_width=50)
                for r in rows:
                    cf = json.loads(r["case_file_json"])
                    summary = (cf.get("verdict_summary") or "")[:80] + ("..." if len(cf.get("verdict_summary") or "") > 80 else "")
                    table.add_row(
                        r["concluded_at"][:19] if r["concluded_at"] else "",
                        r["investigation_id"][:8] + "...",
                        r["source_file"],
                        cf.get("crime_classification", ""),
                        cf.get("severity_score", ""),
                        summary,
                    )
                console.print(table)

    if show_plogs:
        flags_path = log_path / "patrol_flags.jsonl"
        if not flags_path.exists():
            console.print("[dim]No patrol_flags.jsonl found.[/dim]")
        else:
            lines = flags_path.read_text(encoding="utf-8").strip().splitlines()
            lines = [l for l in lines if l.strip()][-limit:]
            if not lines:
                console.print("[dim]No patrol flags.[/dim]")
            else:
                table = Table(title="Patrol flags (most recent)")
                table.add_column("Flag ID", style="cyan")
                table.add_column("Target", style="green")
                table.add_column("Severity")
                table.add_column("Summary", max_width=60)
                for line in reversed(lines):
                    try:
                        f = json.loads(line)
                        table.add_row(
                            (f.get("flag_id") or "")[:8] + "...",
                            f.get("source_file", f.get("target_agent_id", "")),
                            str(f.get("consensus_severity", "")),
                            (f.get("referral_summary") or "")[:80] + "...",
                        )
                    except json.JSONDecodeError:
                        continue
                console.print(table)


@police.command("investigate")
@click.option("--flag-id", "flag_id", required=True, help="Flag UUID from patrol_flags.jsonl, or 1-based index (e.g. 1 = latest). Do not wrap in angle brackets.")
@click.pass_context
def police_investigate(ctx: click.Context, flag_id: str) -> None:
    """Run investigation for a patrol flag. Requires OPENAI_API_KEY or ANTHROPIC_API_KEY. Use a venv and install with 'pip install -e .' so langgraph and other deps are available."""
    from sentrix.police.config import POLICE_DEPLOYMENT
    if not POLICE_DEPLOYMENT:
        console.print("[red]Police investigate requires OPENAI_API_KEY or ANTHROPIC_API_KEY.[/red]")
        raise SystemExit(1)

    log_path = ctx.obj["log_dir"]
    flags_path = log_path / "patrol_flags.jsonl"
    if not flags_path.exists():
        console.print("[red]patrol_flags.jsonl not found.[/red]")
        raise SystemExit(1)

    lines = [l for l in flags_path.read_text(encoding="utf-8").strip().splitlines() if l.strip()]
    patrol_flag = None
    if flag_id.isdigit():
        idx = int(flag_id)
        if 1 <= idx <= len(lines):
            patrol_flag = json.loads(lines[-idx])
    else:
        for line in reversed(lines):
            obj = json.loads(line)
            if obj.get("flag_id") == flag_id:
                patrol_flag = obj
                break
    if not patrol_flag:
        console.print("[red]Flag not found.[/red]")
        raise SystemExit(1)

    async def _run() -> None:
        from sentrix.police.run import run_investigation
        await run_investigation(patrol_flag, log_path)

    asyncio.run(_run())


@main.command()
def stop() -> None:
    """Stop any running sentrix sandbox (best-effort)."""
    import shutil
    import subprocess

    docker_bin = shutil.which("docker")
    if not docker_bin:
        console.print("[red]docker not found[/red]")
        raise SystemExit(1)

    result = subprocess.run(
        [docker_bin, "ps", "--filter", "ancestor=sentrix-openclaw:latest", "-q"],
        capture_output=True,
        text=True,
        check=False,
    )
    container_ids = result.stdout.strip().splitlines()
    if not container_ids:
        console.print("[dim]No running sentrix containers found.[/dim]")
        return

    for cid in container_ids:
        subprocess.run([docker_bin, "stop", cid], check=False)
        console.print(f"[green]Stopped container {cid[:12]}[/green]")

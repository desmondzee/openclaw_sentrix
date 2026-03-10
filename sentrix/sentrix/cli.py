"""Sentrix CLI – sandboxed OpenClaw with API log capture."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

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
def run(
    log_dir: str,
    rotate_mins: int,
    reasoning: bool | None,
    port: int,
    timeout_mins: int,
    extra_env: tuple[str, ...],
    image: str,
    verbose: bool,
) -> None:
    """Start sandboxed OpenClaw (create, health check, channel login, log sync).

    Runs in the foreground until Ctrl+C. In another terminal run
    'sentrix chat' to attach an interactive agent session. When called
    without -e flags, launches an interactive setup wizard for provider,
    API key, model, and channels.
    """
    from sentrix.sandbox import run_sandbox

    parsed_env = _parse_env_pairs(extra_env)

    # If no API key env vars were provided, run the interactive wizard
    has_api_key = any(
        k.endswith("_API_KEY") or k.endswith("_TOKEN") or k == "GEMINI_API_KEY"
        for k in parsed_env
    )

    interactive_channels: list[str] = []

    if not has_api_key:
        from sentrix.wizard import run_setup_wizard
        wizard_env, interactive_channels = run_setup_wizard()

        if reasoning is None:
            reasoning = wizard_env.pop("OPENCLAW_REASONING", None) == "on"
        else:
            wizard_env.pop("OPENCLAW_REASONING", None)

        parsed_env.update(wizard_env)

    if reasoning is None:
        reasoning = True

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
    )

    console.print()
    console.print(f"[bold]sentrix[/bold] starting sandbox (image={config.image})")
    console.print(f"  logs → {config.log_dir.resolve()}")
    console.print(f"  rotation every {config.rotate_mins}min | port {config.port}")

    try:
        asyncio.run(run_sandbox(config))
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

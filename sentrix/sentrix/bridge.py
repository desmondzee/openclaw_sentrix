"""WSS bridge: TLS-terminating WebSocket proxy from browser to OpenClaw Gateway in sandbox."""

from __future__ import annotations

import asyncio
import http
import logging
import ssl
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import websockets

from sentrix.config import GATEWAY_PORT
from sentrix.sandbox import connect_sandbox, read_sandbox_id

logger = logging.getLogger(__name__)


class _SuppressInvalidUpgradeTraceback(logging.Filter):
    """Suppress noisy tracebacks when someone opens the WSS port in a browser (plain HTTP -> InvalidUpgrade)."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # Suppress "connection rejected (426 Upgrade Required)" from websockets when opening WSS port in browser
        if "connection rejected" in msg and "426" in msg:
            return False
        # Suppress "connection rejected (200 OK)" — we return 200 for plain GET (cert trust) on WSS port
        if "connection rejected" in msg and "200" in msg:
            return False
        if "opening handshake failed" not in msg:
            return True
        if record.exc_info and record.exc_info[1] is not None:
            exc = record.exc_info[1]
            if "InvalidUpgrade" in type(exc).__name__ or "keep-alive" in str(exc):
                return False
        return True


def _install_suppress_filter() -> None:
    """Install InvalidUpgrade traceback filter on root and websockets loggers (they may have their own handlers)."""
    f = _SuppressInvalidUpgradeTraceback()
    logging.getLogger().addFilter(f)
    for name in ("websockets", "websockets.server", "websockets.asyncio", "websockets.asyncio.server"):
        logging.getLogger(name).addFilter(f)

# Origins allowed for WebSocket connections (no trailing slashes; browsers do not send them).
DEFAULT_ORIGINS = frozenset({
    "https://openclaw-sentrix.vercel.app",
    "http://localhost:3000",
    "https://localhost:3000",
})

PING_BODY = b"Sentrix Bridge is running. You can close this tab."
# Shown when user opens the WSS port (e.g. https://localhost:8766) in browser to accept the cert.
CERT_ACCEPTED_BODY = b"Certificate accepted for WSS. Close this tab and return to the app."

# websockets 13+ asyncio server expects process_request to return a Response object, not a tuple
try:
    from websockets.http11 import Response as WSResponse
    from websockets.datastructures import Headers as WSHeaders
    _USE_WS_RESPONSE = True
except ImportError:
    WSResponse = None
    WSHeaders = None
    _USE_WS_RESPONSE = False


def _is_websocket_upgrade_request(request: Any) -> bool:
    """True if the request is a WebSocket handshake (Upgrade: websocket)."""
    headers = getattr(request, "headers", None)
    if not headers:
        return False
    upgrade = (headers.get("Upgrade") or headers.get("upgrade") or "").strip()
    return "websocket" in upgrade.lower()


def _get_process_request():
    """Return process_request for websockets.serve.
    Handles plain HTTP GET (e.g. user opening WSS URL in browser to trust cert)
    by returning 200 OK so they see a friendly message instead of InvalidUpgrade.
    Asyncio (v13+): (connection, request) -> Response | None.
    """

    def process_request(connection: Any, request: Any) -> Any:
        # If this is a real WebSocket upgrade, let the library handle it.
        if _is_websocket_upgrade_request(request):
            return None
        # Plain GET (browser navigation to https://localhost:8766) — return 200 for cert trust.
        body = CERT_ACCEPTED_BODY
        if _USE_WS_RESPONSE and WSResponse is not None and WSHeaders is not None:
            headers = WSHeaders()
            headers["Content-Type"] = "text/plain; charset=utf-8"
            headers["Content-Length"] = str(len(body))
            headers["Connection"] = "close"
            return WSResponse(200, "OK", headers, body)
        # Old websockets without http11.Response: let handshake run (user will see InvalidUpgrade page).
        return None

    return process_request


def _load_origins() -> frozenset[str]:
    import os
    raw = os.environ.get("SENTRIX_BRIDGE_ORIGINS")
    if not raw:
        return DEFAULT_ORIGINS
    return frozenset(o.strip().rstrip("/") for o in raw.split(",") if o.strip())


def _check_origin(origin: str | None, allowed: frozenset[str]) -> bool:
    if not origin:
        return False
    return origin.rstrip("/") in allowed


def _make_ssl_context(
    cert_path: Path | None = None,
    key_path: Path | None = None,
    cert_cache_path: Path | None = None,
) -> ssl.SSLContext:
    if cert_path and key_path and cert_path.exists() and key_path.exists():
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert_path), str(key_path))
        return ctx

    if cert_cache_path and cert_cache_path.exists():
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert_cache_path))
        return ctx

    # Generate self-signed cert with cryptography (365 days, SAN localhost).
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError as e:
        raise RuntimeError(
            "Bridge TLS requires the cryptography package. Install with: pip install cryptography"
        ) from e

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    not_valid_after = now + timedelta(days=365)  # Apple 398-day limit; use 365

    import ipaddress
    san_list = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Sentrix Bridge")]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(not_valid_after)
        .add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        )
    )
    cert = builder.sign(key, hashes.SHA256())

    cache = cert_cache_path or (Path.home() / ".sentrix" / "bridge.pem")
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "wb") as f:
        f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cache))
    logger.info("Generated self-signed cert at %s (valid 365 days, SAN localhost + 127.0.0.1)", cache)
    return ctx


async def _proxy_connection(
    browser_ws: websockets.WebSocketServerProtocol,
    log_dir: Path,
) -> None:
    """Handle one browser connection: connect to gateway and forward frames."""
    sandbox_id = read_sandbox_id(log_dir)
    if not sandbox_id:
        await browser_ws.close(1011, "No sandbox: run 'sentrix run' and ensure .sentrix_sandbox_id exists in log_dir")
        return

    try:
        sandbox = await connect_sandbox(sandbox_id)
    except Exception as e:
        logger.exception("Failed to connect to sandbox")
        await browser_ws.close(1011, f"Sandbox connection failed: {e}")
        return

    try:
        endpoint_info = await sandbox.get_endpoint(GATEWAY_PORT)
        # endpoint_info.endpoint is e.g. "host:port/proxy/18789"
        raw = getattr(endpoint_info, "endpoint", str(endpoint_info))
        gateway_ws_url = f"ws://{raw}" if not raw.startswith("ws") else raw
    except Exception as e:
        logger.exception("Failed to get gateway endpoint")
        await browser_ws.close(1011, f"Gateway endpoint failed: {e}")
        return

    try:
        async with websockets.connect(gateway_ws_url, close_timeout=2) as gateway_ws:
            async def from_browser_to_gateway() -> None:
                try:
                    async for message in browser_ws:
                        await gateway_ws.send(message)
                except websockets.ConnectionClosed:
                    pass
                finally:
                    await gateway_ws.close()

            async def from_gateway_to_browser() -> None:
                try:
                    async for message in gateway_ws:
                        await browser_ws.send(message)
                except websockets.ConnectionClosed:
                    pass
                finally:
                    await browser_ws.close()

            await asyncio.gather(
                from_browser_to_gateway(),
                from_gateway_to_browser(),
            )
    except Exception as e:
        logger.debug("Gateway connection closed: %s", e)
        try:
            await browser_ws.close()
        except Exception:
            pass


async def _handler(
    ws: websockets.WebSocketServerProtocol,
    log_dir: Path,
    allowed_origins: frozenset[str],
) -> None:
    """Per-connection handler: check origin then proxy."""
    origin = None
    if hasattr(ws, "request_headers"):
        origin = ws.request_headers.get("Origin") or ws.request_headers.get("origin")
    request = getattr(ws, "request", None)
    if origin is None and request is not None:
        headers = getattr(request, "headers", None)
        if headers:
            origin = headers.get("Origin") or headers.get("origin")

    if not _check_origin(origin, allowed_origins):
        logger.warning(
            "Rejected WebSocket connection: origin %r not in allowlist %s",
            origin,
            sorted(allowed_origins),
        )
        await ws.close(1008, "Origin not allowed")
        return

    logger.info("WebSocket connection accepted (origin=%r)", origin)
    await _proxy_connection(ws, log_dir)


def run_bridge(
    log_dir: Path,
    host: str = "0.0.0.0",
    port: int = 8766,
    cert_path: Path | None = None,
    key_path: Path | None = None,
) -> None:
    """Run the WSS bridge (blocking). WSS is on --port (default 8766). A separate
    HTTPS server on port - 1 (default 8765) serves GET / and GET /ping with 200 OK
    so you can open it in a browser to trust the cert without hitting the WebSocket
    server (which would reject plain HTTP with 426 and noisy tracebacks).
    """
    logging.basicConfig(level=logging.INFO, format="[bridge] %(message)s")
    _install_suppress_filter()
    allowed = _load_origins()
    cert_cache = Path.home() / ".sentrix" / "bridge.pem"
    ssl_ctx = _make_ssl_context(cert_path, key_path, cert_cache)

    trust_port = port - 1  # HTTPS-only: any GET -> 200 OK for cert trust
    display_host = "127.0.0.1" if host == "0.0.0.0" else host or "localhost"

    async def handler(ws: websockets.WebSocketServerProtocol) -> None:
        await _handler(ws, log_dir, allowed)

    async def _serve() -> None:
        loop = asyncio.get_running_loop()
        trust_server = await loop.create_server(
            lambda: _TrustProtocol(PING_BODY),
            host,
            trust_port,
            ssl=ssl_ctx,
        )
        logger.info(
            "Trust server (open in browser to accept cert): https://%s:%s or https://%s:%s/ping",
            display_host,
            trust_port,
            display_host,
            trust_port,
        )
        async with websockets.serve(
            handler,
            host,
            port,
            ssl=ssl_ctx,
            ping_interval=20,
            ping_timeout=20,
            process_request=_get_process_request(),
        ) as wss_server:
            logger.info(
                "Bridge WSS: wss://%s:%s",
                display_host,
                port,
            )
            await asyncio.Future()

    asyncio.run(_serve())


class _TrustProtocol(asyncio.Protocol):
    """HTTPS handler: any GET (/, /ping, etc.) -> 200 OK. Used only for cert trust."""

    def __init__(self, body: bytes) -> None:
        self.body = body

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport

    def data_received(self, data: bytes) -> None:
        try:
            first_line = data.split(b"\r\n", 1)[0].decode("utf-8", errors="replace")
            if first_line.startswith("GET "):
                response = (
                    b"HTTP/1.1 200 OK\r\n"
                    b"Content-Type: text/plain; charset=utf-8\r\n"
                    b"Content-Length: " + str(len(self.body)).encode() + b"\r\n"
                    b"Connection: close\r\n\r\n"
                ) + self.body
                self.transport.write(response)
        except Exception:
            pass
        self.transport.close()

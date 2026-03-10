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

# Origins allowed for WebSocket connections (no trailing slashes; browsers do not send them).
DEFAULT_ORIGINS = frozenset({
    "https://openclaw-sentrix.vercel.app",
    "http://localhost:3000",
    "https://localhost:3000",
})

PING_BODY = b"Sentrix Bridge is running. You can close this tab."

# websockets 13+ asyncio server expects process_request to return a Response object, not a tuple
try:
    from websockets.http11 import Response as WSResponse
    from websockets.datastructures import Headers as WSHeaders
    _USE_WS_RESPONSE = True
except ImportError:
    WSResponse = None
    WSHeaders = None
    _USE_WS_RESPONSE = False


def _get_process_request():
    """Return process_request callable for websockets.serve (GET /ping).
    Legacy (v10): (path, request_headers) -> (HTTPStatus, headers_list, body) | None.
    Asyncio (v13+): (connection, request) -> websockets.http11.Response | None.
    """

    async def process_request(
        path_or_connection: Any,
        request_headers_or_request: Any,
    ) -> Any:
        path = (
            getattr(request_headers_or_request, "path", path_or_connection)
            if not isinstance(path_or_connection, str)
            else path_or_connection
        )
        if not isinstance(path, str) or path.split("?")[0].rstrip("/") != "/ping":
            return None
        if _USE_WS_RESPONSE and WSResponse is not None and WSHeaders is not None:
            return WSResponse(200, "OK", WSHeaders(), PING_BODY)
        return (http.HTTPStatus.OK, [], PING_BODY)

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

    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Sentrix Bridge")]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(not_valid_after)
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost")]),
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
    logger.info("Generated self-signed cert at %s (valid 365 days, SAN localhost)", cache)
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
        logger.warning("Rejected origin: %r", origin)
        await ws.close(1008, "Origin not allowed")
        return

    await _proxy_connection(ws, log_dir)


def run_bridge(
    log_dir: Path,
    host: str = "0.0.0.0",
    port: int = 8765,
    cert_path: Path | None = None,
    key_path: Path | None = None,
) -> None:
    """Run the WSS bridge server (blocking). WSS listens on --port; a separate
    HTTPS server listens on port - 1 for GET /ping only (for cert trust).
    """
    allowed = _load_origins()
    cert_cache = Path.home() / ".sentrix" / "bridge.pem"
    ssl_ctx = _make_ssl_context(cert_path, key_path, cert_cache)

    ping_port = port - 1
    ping_host = "127.0.0.1" if host == "0.0.0.0" else host
    display_host = ping_host or "localhost"

    async def handler(ws: websockets.WebSocketServerProtocol) -> None:
        await _handler(ws, log_dir, allowed)

    async def _serve() -> None:
        loop = asyncio.get_running_loop()
        ping_server = await loop.create_server(
            lambda: _PingProtocol(PING_BODY),
            host,
            ping_port,
            ssl=ssl_ctx,
        )
        logger.info(
            "Ping server (cert trust): https://%s:%s/ping",
            display_host,
            ping_port,
        )
        async with websockets.serve(
            handler,
            host,
            port,
            ssl=ssl_ctx,
            ping_interval=20,
            ping_timeout=20,
        ) as wss_server:
            logger.info(
                "Bridge WSS: wss://%s:%s (to trust cert, open https://%s:%s/ping)",
                display_host,
                port,
                display_host,
                ping_port,
            )
            await asyncio.Future()

    asyncio.run(_serve())


class _PingProtocol(asyncio.Protocol):
    """Minimal HTTPS handler: only GET /ping -> 200 OK."""

    def __init__(self, body: bytes) -> None:
        self.body = body

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport

    def data_received(self, data: bytes) -> None:
        try:
            first_line = data.split(b"\r\n", 1)[0].decode("utf-8", errors="replace")
            if first_line.startswith("GET /ping") or first_line.startswith("GET /ping?"):
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

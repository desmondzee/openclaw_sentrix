"""WSS bridge: TLS-terminating WebSocket proxy from browser to OpenClaw Gateway in sandbox."""

from __future__ import annotations

import asyncio
import http
import json
import logging
import ssl
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import websockets

from sentrix.config import GATEWAY_PORT
from sentrix.sandbox import connect_sandbox, get_direct_endpoint, read_sandbox_id

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
    """Handle one browser connection: connect to gateway, perform handshake, and relay chat."""
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
        # Use direct endpoint to bypass opensandbox-server proxy (no WS support; OpenSandbox #383)
        raw = (await get_direct_endpoint(sandbox, GATEWAY_PORT)).strip().rstrip("/")
        if raw.startswith("https://"):
            gateway_ws_url = "wss://" + raw[8:]
        elif raw.startswith("http://"):
            gateway_ws_url = "ws://" + raw[7:]
        elif raw.startswith("ws://") or raw.startswith("wss://"):
            gateway_ws_url = raw
        else:
            gateway_ws_url = "ws://" + raw
        logger.info("Gateway WebSocket URL: %s", gateway_ws_url)
    except Exception as e:
        logger.exception("Failed to get gateway endpoint")
        await browser_ws.close(1011, f"Gateway endpoint failed: {e}")
        return

    from websockets.exceptions import InvalidStatus, InvalidURI
    import uuid

    url_to_try = gateway_ws_url
    try:
        for attempt in range(2):
            try:
                logger.info("Connecting to gateway... (attempt %s)", attempt + 1)
                async with websockets.connect(url_to_try, close_timeout=5) as gateway_ws:
                    logger.info("Gateway WebSocket connected")

                    # ------ Gateway Protocol Handshake ------
                    # 1. Receive connect.challenge from gateway
                    challenge_raw = await asyncio.wait_for(gateway_ws.recv(), timeout=10)
                    challenge = json.loads(challenge_raw)
                    if challenge.get("type") != "event" or challenge.get("event") != "connect.challenge":
                        logger.warning("Expected connect.challenge, got: %s", challenge.get("event"))
                        await browser_ws.close(1011, "Gateway protocol error: no connect.challenge")
                        return

                    nonce = challenge.get("payload", {}).get("nonce", "")
                    if not nonce:
                        logger.warning("connect.challenge missing nonce")
                        await browser_ws.close(1011, "Gateway protocol error: missing nonce")
                        return
                    logger.info("Received connect.challenge (nonce=%s...)", nonce[:8])

                    # 2. Send connect handshake
                    connect_id = str(uuid.uuid4())
                    connect_frame = {
                        "type": "req",
                        "id": connect_id,
                        "method": "connect",
                        "params": {
                            "minProtocol": 3,
                            "maxProtocol": 3,
                            "client": {
                                "id": "gateway-client",
                                "displayName": "Sentrix Bridge",
                                "version": "1.0.0",
                                "platform": "python",
                                "mode": "backend",
                            },
                            "auth": {
                                "token": "sentrix-bridge-token",
                            },
                            "role": "operator",
                            "scopes": ["operator.admin"],
                        },
                    }
                    await gateway_ws.send(json.dumps(connect_frame))
                    logger.info("Sent connect handshake")

                    # 3. Receive hello-ok response
                    hello_raw = await asyncio.wait_for(gateway_ws.recv(), timeout=10)
                    hello = json.loads(hello_raw)
                    if hello.get("type") == "res" and hello.get("id") == connect_id:
                        if hello.get("ok"):
                            logger.info("Gateway handshake OK (protocol %s)",
                                        hello.get("payload", {}).get("protocol", "?"))
                        else:
                            err_msg = hello.get("error", {}).get("message", "unknown error")
                            logger.error("Gateway connect rejected: %s", err_msg)
                            await browser_ws.close(1011, f"Gateway rejected: {err_msg}"[:123])
                            return
                    else:
                        logger.warning("Unexpected response to connect: %s", hello)
                        await browser_ws.close(1011, "Gateway protocol error: unexpected connect response")
                        return

                    # Notify browser that bridge is ready
                    await browser_ws.send(json.dumps({
                        "type": "bridge.ready",
                        "payload": {"status": "connected"},
                    }))

                    logger.info("Gateway handshake complete, proxying chat")

                    # ------ Protocol-Aware Relay ------
                    # Track pending requests and accumulated response text
                    session_key = "main"
                    pending_runs: dict[str, str] = {}  # gateway runId -> browser msgId
                    run_buffers: dict[str, str] = {}   # runId -> accumulated text

                    async def from_browser_to_gateway() -> None:
                        """Translate browser chat messages into gateway chat.send requests."""
                        try:
                            async for raw_msg in browser_ws:
                                try:
                                    msg = json.loads(raw_msg)
                                except (json.JSONDecodeError, TypeError):
                                    logger.warning("Non-JSON message from browser, ignoring")
                                    continue

                                msg_type = msg.get("type", "")
                                browser_id = msg.get("id", str(uuid.uuid4()))

                                if msg_type == "chat":
                                    text = (msg.get("payload", {}).get("text", "") or "").strip()
                                    if not text:
                                        continue

                                    # Build gateway chat.send request
                                    run_id = str(uuid.uuid4())
                                    pending_runs[run_id] = browser_id
                                    run_buffers[run_id] = ""

                                    chat_req = {
                                        "type": "req",
                                        "id": run_id,
                                        "method": "chat.send",
                                        "params": {
                                            "sessionKey": session_key,
                                            "message": text,
                                            "idempotencyKey": run_id,
                                        },
                                    }
                                    await gateway_ws.send(json.dumps(chat_req))
                                    logger.info("Sent chat.send (runId=%s, text=%.50s...)", run_id, text)

                                elif msg_type == "abort":
                                    # Forward abort to gateway
                                    abort_req = {
                                        "type": "req",
                                        "id": str(uuid.uuid4()),
                                        "method": "chat.abort",
                                        "params": {"sessionKey": session_key},
                                    }
                                    await gateway_ws.send(json.dumps(abort_req))

                                else:
                                    logger.debug("Ignoring unknown browser message type: %s", msg_type)

                        except websockets.ConnectionClosed:
                            pass
                        finally:
                            await gateway_ws.close()

                    async def from_gateway_to_browser() -> None:
                        """Translate gateway events into simple browser messages."""
                        try:
                            async for raw_msg in gateway_ws:
                                try:
                                    msg = json.loads(raw_msg)
                                except (json.JSONDecodeError, TypeError):
                                    continue

                                msg_type = msg.get("type", "")

                                if msg_type == "event":
                                    event_name = msg.get("event", "")
                                    payload = msg.get("payload", {})

                                    if event_name == "agent":
                                        # Streaming assistant text via agent events
                                        run_id = payload.get("runId", "")
                                        stream = payload.get("stream", "")
                                        data = payload.get("data", {})

                                        if stream == "assistant" and isinstance(data, dict):
                                            accumulated = data.get("text", "")
                                            delta = data.get("delta", "")
                                            browser_id = pending_runs.get(run_id, run_id)

                                            if delta and accumulated:
                                                run_buffers[run_id] = accumulated
                                                await browser_ws.send(json.dumps({
                                                    "type": "response.delta",
                                                    "id": browser_id,
                                                    "payload": {
                                                        "text": delta,
                                                        "accumulated": accumulated,
                                                    },
                                                }))

                                    elif event_name == "chat":
                                        run_id = payload.get("runId", "")
                                        state = payload.get("state", "")
                                        browser_id = pending_runs.get(run_id, run_id)

                                        # Extract text from message.content[]
                                        message_data = payload.get("message", {})
                                        text = ""
                                        if isinstance(message_data, dict) and "content" in message_data:
                                            content = message_data["content"]
                                            if isinstance(content, str):
                                                text = content
                                            elif isinstance(content, list):
                                                parts = []
                                                for block in content:
                                                    if isinstance(block, dict) and block.get("type") == "text":
                                                        parts.append(block.get("text", ""))
                                                    elif isinstance(block, str):
                                                        parts.append(block)
                                                text = "\n".join(parts)

                                        if state == "final":
                                            final_text = text or run_buffers.get(run_id, "")
                                            await browser_ws.send(json.dumps({
                                                "type": "response",
                                                "id": browser_id,
                                                "payload": {"text": final_text},
                                            }))
                                            pending_runs.pop(run_id, None)
                                            run_buffers.pop(run_id, None)
                                            logger.info("Chat response final (runId=%s, len=%d)", run_id, len(final_text))

                                        elif state == "error":
                                            error_msg = payload.get("errorMessage", "Agent error")
                                            await browser_ws.send(json.dumps({
                                                "type": "response",
                                                "id": browser_id,
                                                "payload": {"text": f"⚠️ {error_msg}"},
                                            }))
                                            pending_runs.pop(run_id, None)
                                            run_buffers.pop(run_id, None)
                                            logger.warning("Chat error (runId=%s): %s", run_id, error_msg)

                                        elif state == "aborted":
                                            partial = run_buffers.get(run_id, "")
                                            text_to_send = partial + "\n\n_(aborted)_" if partial else "_(aborted)_"
                                            await browser_ws.send(json.dumps({
                                                "type": "response",
                                                "id": browser_id,
                                                "payload": {"text": text_to_send},
                                            }))
                                            pending_runs.pop(run_id, None)
                                            run_buffers.pop(run_id, None)

                                    elif event_name == "tick":
                                        pass  # Gateway keepalive

                                    # Silently ignore health, presence, etc.

                                elif msg_type == "res":
                                    # Response to our chat.send — just an ack
                                    res_id = msg.get("id", "")
                                    if not msg.get("ok"):
                                        error_msg = msg.get("error", {}).get("message", "request failed")
                                        browser_id = pending_runs.get(res_id, res_id)
                                        await browser_ws.send(json.dumps({
                                            "type": "response",
                                            "id": browser_id,
                                            "payload": {"text": f"⚠️ {error_msg}"},
                                        }))
                                        pending_runs.pop(res_id, None)
                                        run_buffers.pop(res_id, None)
                                        logger.warning("Gateway request failed (id=%s): %s", res_id, error_msg)

                        except websockets.ConnectionClosed:
                            pass
                        finally:
                            await browser_ws.close()

                    await asyncio.gather(
                        from_browser_to_gateway(),
                        from_gateway_to_browser(),
                    )
                    return
            except InvalidURI as e:
                if attempt == 0 and getattr(e, "uri", "").startswith("http"):
                    url_to_try = e.uri.replace("https://", "wss://").replace("http://", "ws://")
                    logger.info("Redirect target was http; retrying with %s", url_to_try)
                    continue
                raise
            except InvalidStatus as e:
                body = getattr(getattr(e, "response", None), "body", b"") or b""
                logger.warning(
                    "Gateway rejected WebSocket: HTTP %s %.200s",
                    getattr(e.response, "status_code", None),
                    body.decode("utf-8", errors="replace") if isinstance(body, bytes) else body,
                )
                raise
    except Exception as e:
        logger.warning("Gateway connection failed or closed: %s", e, exc_info=False)
        try:
            await browser_ws.close(1011, f"Gateway error: {e!s}"[:123])
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

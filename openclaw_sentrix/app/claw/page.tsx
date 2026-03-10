"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "claw_bridge_url";
const DEFAULT_BRIDGE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_CLAW_WS_URL
    ? process.env.NEXT_PUBLIC_CLAW_WS_URL
    : "wss://localhost:8766";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

type MessageRole = "user" | "assistant";
interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

/** Trust server runs on port - 1. Open in browser to accept the cert. */
function bridgeUrlToTrustUrl(wssUrl: string): string {
  try {
    const u = new URL(wssUrl);
    u.protocol = "https:";
    const portNum = parseInt(u.port || "8766", 10);
    u.port = String(portNum - 1);
    u.pathname = "/";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "https://localhost:8765";
  }
}

/** Same host/port as WSS. Opening this and accepting the cert trusts the WebSocket connection (browsers trust per port). */
function bridgeUrlToWssTrustUrl(wssUrl: string): string {
  try {
    const u = new URL(wssUrl);
    u.protocol = "https:";
    u.pathname = "/";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "https://localhost:8766";
  }
}

export default function ClawPage() {
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE_URL);
  const [isMounted, setIsMounted] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected" | "error"
  >("idle");
  const [lastClose, setLastClose] = useState<{ code: number; reason: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const backoffMsRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Load bridge URL from localStorage only on client after mount (avoid hydration mismatch)
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) setBridgeUrl(saved.trim());
    } catch {
      // ignore
    }
  }, []);

  // Persist bridge URL to localStorage when user changes it
  const saveBridgeUrl = useCallback((url: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, url);
    } catch {
      // ignore
    }
  }, []);

  // Connect WebSocket when mounted and we have a URL; re-run when reconnectKey changes.
  // Single active connection (guard via wsRef). Auto-reconnect with exponential backoff on unexpected close.
  useEffect(() => {
    if (!isMounted || !bridgeUrl.trim()) return;

    isUnmountedRef.current = false;
    const url = bridgeUrl.trim();

    const connect = () => {
      if (isUnmountedRef.current || wsRef.current != null) return;
      setConnectionStatus("connecting");
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        backoffMsRef.current = INITIAL_BACKOFF_MS; // reset backoff on successful connect
        setLastClose(null);
        setConnectionStatus("connected");
      };

      ws.onclose = (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setLastClose({ code: event.code, reason: event.reason || "" });
          setConnectionStatus("disconnected");
          // Auto-reconnect with exponential backoff (only if still mounted and no other WS)
          if (!isUnmountedRef.current && event.code !== 1000) {
            const delay = backoffMsRef.current;
            backoffMsRef.current = Math.min(backoffMsRef.current * 2, MAX_BACKOFF_MS);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              setReconnectKey((k) => k + 1);
            }, delay);
          }
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) setConnectionStatus("error");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            id?: string;
            payload?: { text?: string };
          };
          if (msg.type === "response" && msg.payload?.text != null) {
            const id = msg.id ?? `r-${Date.now()}`;
            setMessages((prev) => [
              ...prev,
              { id, role: "assistant", text: msg.payload!.text! },
            ]);
            if (pendingIdRef.current === id) pendingIdRef.current = null;
          }
        } catch {
          // ignore parse errors
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "nav");
        wsRef.current = null;
      }
    };
  }, [isMounted, bridgeUrl, reconnectKey]);

  const sendMessage = useCallback(() => {
    const text = inputValue.trim();
    if (!text || connectionStatus !== "connected" || !wsRef.current) return;

    const id = `msg-${Date.now()}`;
    pendingIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: "user", text }]);
    setInputValue("");

    const payload = {
      type: "chat",
      id,
      payload: { text },
      timestamp: new Date().toISOString(),
    };
    wsRef.current.send(JSON.stringify(payload));
  }, [inputValue, connectionStatus]);

  const showErrorBanner =
    (connectionStatus === "error" || connectionStatus === "disconnected") &&
    isMounted &&
    bridgeUrl.trim().length > 0;
  const trustUrl = bridgeUrlToTrustUrl(bridgeUrl.trim() || DEFAULT_BRIDGE_URL);
  const wssTrustUrl = bridgeUrlToWssTrustUrl(bridgeUrl.trim() || DEFAULT_BRIDGE_URL);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[var(--background)]">
      <div className="shrink-0 border-b border-[var(--pixel-border)] bg-[var(--surface)] px-4 py-3">
        <label className="mb-2 block font-[family-name:var(--font-pixel)] text-xs font-bold text-[var(--foreground)]">
          Bridge URL
        </label>
        <input
          type="url"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          onBlur={() => saveBridgeUrl(bridgeUrl)}
          placeholder="wss://localhost:8766"
          className="w-full rounded border border-[var(--pixel-border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-gray-500 focus:border-[var(--accent)] focus:outline-none"
        />
        <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-gray-500">
          Status:{" "}
          {connectionStatus === "connecting" && "Connecting…"}
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "disconnected" && "Disconnected"}
          {connectionStatus === "error" && "Error"}
          {connectionStatus === "idle" && "Idle"}
          {(connectionStatus === "error" || connectionStatus === "disconnected") && (
            <button
              type="button"
              onClick={() => {
                backoffMsRef.current = INITIAL_BACKOFF_MS;
                setReconnectKey((k) => k + 1);
              }}
              className="rounded border border-amber-500/50 bg-amber-500/20 px-2 py-1 font-mono text-xs text-amber-200 hover:bg-amber-500/30"
            >
              Reconnect
            </button>
          )}
          {lastClose != null && (connectionStatus === "disconnected" || connectionStatus === "error") && (
            <span className="text-gray-400" title="Last close reason">
              (close {lastClose.code}
              {lastClose.reason ? `: ${lastClose.reason}` : ""})
            </span>
          )}
        </p>
      </div>

      {showErrorBanner && (
        <div className="border-b border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="font-mono text-sm text-amber-200">
            Cannot connect to Local Claw. Browsers trust certificates per port. Accept the cert for both:
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 font-mono text-sm text-amber-200">
            <li>
              <a href={trustUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100">
                Trust server
              </a>{" "}
              — you should see &quot;Sentrix Bridge is running&quot;.
            </li>
            <li>
              <a href={wssTrustUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100">
                WSS port
              </a>{" "}
              — accept the certificate (e.g. &quot;Advanced&quot; → &quot;Proceed to localhost&quot;). You should then see &quot;Certificate accepted for WSS. Close this tab.&quot;
            </li>
          </ol>
          <p className="mt-2 font-mono text-xs text-amber-200/80">
            Use the same host in the Bridge URL as you trusted (e.g. wss://localhost:8766 or wss://127.0.0.1:8766). Then click <strong>Reconnect</strong> or change the URL and blur to retry.
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && connectionStatus === "connected" && (
            <p className="font-mono text-sm text-gray-500">
              Say something to your Claw…
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg bg-[var(--accent)]/20 px-3 py-2 font-mono text-sm"
                    : "max-w-[85%] rounded-lg bg-[var(--surface)] border border-[var(--pixel-border)] px-3 py-2 font-mono text-sm whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--pixel-border)] bg-[var(--surface)] p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type a message…"
            disabled={connectionStatus !== "connected"}
            className="flex-1 rounded border border-[var(--pixel-border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-gray-500 focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={connectionStatus !== "connected" || !inputValue.trim()}
            className="rounded bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-pixel)] text-sm font-bold text-white hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

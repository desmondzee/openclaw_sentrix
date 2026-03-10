"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "claw_bridge_url";
const DEFAULT_BRIDGE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_CLAW_WS_URL
    ? process.env.NEXT_PUBLIC_CLAW_WS_URL
    : "wss://localhost:8765";

type MessageRole = "user" | "assistant";
interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

/** Bridge runs WSS on --port and a separate HTTPS /ping server on port - 1 (for cert trust). */
function bridgeUrlToPingUrl(wssUrl: string): string {
  try {
    const u = new URL(wssUrl);
    u.protocol = "https:";
    const portNum = parseInt(u.port || "8765", 10);
    u.port = String(portNum - 1);
    u.pathname = "/ping";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "https://localhost:8764/ping";
  }
}

/** Same host:port as WSS but https - open this to trust the cert for the WebSocket port. */
function bridgeUrlToWssTrustUrl(wssUrl: string): string {
  try {
    const u = new URL(wssUrl);
    u.protocol = "https:";
    u.pathname = "/";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "https://localhost:8765";
  }
}

export default function ClawPage() {
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE_URL);
  const [isMounted, setIsMounted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected" | "error"
  >("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const pendingIdRef = useRef<string | null>(null);

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

  // Connect WebSocket only when mounted and we have a URL; cleanup on unmount or URL change
  useEffect(() => {
    if (!isMounted || !bridgeUrl.trim()) return;

    const url = bridgeUrl.trim();
    setConnectionStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => setConnectionStatus("connected");
    ws.onclose = () => {
      setConnectionStatus(wsRef.current === ws ? "disconnected" : "idle");
      wsRef.current = null;
    };
    ws.onerror = () => setConnectionStatus("error");

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
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isMounted, bridgeUrl]);

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
  const pingUrl = bridgeUrlToPingUrl(bridgeUrl.trim() || DEFAULT_BRIDGE_URL);
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
          placeholder="wss://localhost:8765"
          className="w-full rounded border border-[var(--pixel-border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-gray-500 focus:border-[var(--accent)] focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-gray-500">
          Status:{" "}
          {connectionStatus === "connecting" && "Connecting…"}
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "disconnected" && "Disconnected"}
          {connectionStatus === "error" && "Error"}
          {connectionStatus === "idle" && "Idle"}
        </p>
      </div>

      {showErrorBanner && (
        <div className="border-b border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="font-mono text-sm text-amber-200">
            Cannot connect to Local Claw. If you are running Sentrix locally:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-sm text-amber-200">
            <li>
              <a
                href={pingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-100"
              >
                Trust the ping server
              </a>{" "}
              (open and accept the certificate).
            </li>
            <li>
              <a
                href={wssTrustUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-100"
              >
                Trust the WSS port
              </a>{" "}
              (you may see an error page; accept the certificate anyway so the app can connect).
            </li>
          </ul>
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

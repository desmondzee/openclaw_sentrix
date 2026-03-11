"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveMessage,
  getRecentMessages,
  type PersistedMessage,
} from "@/lib/chatHistory";

const STORAGE_KEY = "claw_bridge_url";
const DEFAULT_BRIDGE_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_CLAW_WS_URL
    ? process.env.NEXT_PUBLIC_CLAW_WS_URL
    : "wss://localhost:8766";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const PAGE_SIZE = 20;

type MessageRole = "user" | "assistant";
interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** IndexedDB key — present for persisted messages, used for pagination */
  dbKey?: number;
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

/** Render basic inline markdown: **bold** and *italic* */
function renderMarkdown(text: string): React.ReactNode {
  // Split on **bold** first, then *italic* within each segment
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    // Text before the bold
    if (match.index > lastIndex) {
      parts.push(renderItalic(text.slice(lastIndex, match.index), key++));
    }
    // Bold text (also check for italic inside)
    parts.push(
      <strong key={`b${key++}`} style={{ fontWeight: 700 }}>
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }
  // Remaining text after last bold
  if (lastIndex < text.length) {
    parts.push(renderItalic(text.slice(lastIndex), key++));
  }
  return parts.length > 0 ? parts : text;
}

function renderItalic(text: string, baseKey: number): React.ReactNode {
  const italicRegex = /\*(.+?)\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = italicRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <em key={`i${baseKey}-${key++}`}>{match[1]}</em>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <span key={`s${baseKey}`}>{parts}</span> : text;
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
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const backoffMsRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Tracks smallest dbKey in current message list, for pagination cursor */
  const oldestKeyRef = useRef<number | undefined>(undefined);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load bridge URL from localStorage only on client after mount (avoid hydration mismatch)
  // Also load initial chat history from IndexedDB
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) setBridgeUrl(saved.trim());
    } catch {
      // ignore
    }

    // Load recent messages from IndexedDB
    (async () => {
      try {
        const { messages: stored, hasMore: more } = await getRecentMessages(PAGE_SIZE);
        if (stored.length > 0) {
          const loaded: ChatMessage[] = stored.map((m: PersistedMessage) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            dbKey: m.key,
          }));
          setMessages(loaded);
          setHasMore(more);
          oldestKeyRef.current = loaded[0]?.dbKey;
          // Scroll to bottom after loading history
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
          }, 50);
        }
      } catch {
        // IndexedDB unavailable — degrade gracefully
      }
    })();
  }, []);

  // Scroll to bottom when new messages are added (not when loading older ones)
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      // Only auto-scroll if the newest messages were appended (not prepended)
      const lastMsg = messages[messages.length - 1];
      const prevLast = prevMessageCountRef.current;
      if (prevLast > 0) {
        scrollToBottom();
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

  // IntersectionObserver for infinite scroll-up
  useEffect(() => {
    if (!isMounted || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadOlderMessages();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, hasMore, isLoadingMore]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const cursor = oldestKeyRef.current;
      const { messages: older, hasMore: more } = await getRecentMessages(PAGE_SIZE, cursor);
      if (older.length > 0) {
        const loaded: ChatMessage[] = older.map((m: PersistedMessage) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          dbKey: m.key,
        }));

        // Preserve scroll position when prepending
        const container = scrollContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;

        setMessages((prev) => [...loaded, ...prev]);
        setHasMore(more);
        oldestKeyRef.current = loaded[0]?.dbKey;

        // Restore scroll position after DOM update
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop += newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore]);

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
      if (typeof window !== "undefined") {
        console.log("[Claw] Connecting to", url, "reconnectKey:", reconnectKey);
      }
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
        if (typeof window !== "undefined") {
          console.log("[Claw] onclose code=%s reason=%s", event.code, event.reason || "(none)");
        }
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
            payload?: { text?: string; accumulated?: string; status?: string };
          };

          if (msg.type === "bridge.ready") {
            // Gateway handshake complete — bridge is fully connected
            if (typeof window !== "undefined") {
              console.log("[Claw] Bridge ready, gateway connected");
            }
            return;
          }

          if (msg.type === "response.delta" && msg.payload?.accumulated != null) {
            // Streaming delta — update or create the assistant message with accumulated text
            const id = msg.id ?? `r-${Date.now()}`;
            setMessages((prev) => {
              const existing = prev.findIndex((m) => m.id === id && m.role === "assistant");
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], text: msg.payload!.accumulated! };
                return updated;
              }
              return [...prev, { id, role: "assistant", text: msg.payload!.accumulated! }];
            });
            return;
          }

          if (msg.type === "response" && msg.payload?.text != null) {
            const id = msg.id ?? `r-${Date.now()}`;
            const finalText = msg.payload.text;
            setMessages((prev) => {
              // Replace streaming message with final, or add new
              const existing = prev.findIndex((m) => m.id === id && m.role === "assistant");
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], text: finalText };
                return updated;
              }
              return [...prev, { id, role: "assistant", text: finalText }];
            });
            if (pendingIdRef.current === id) pendingIdRef.current = null;

            // Persist final assistant message to IndexedDB
            saveMessage({
              id,
              role: "assistant",
              text: finalText,
              timestamp: Date.now(),
            }).catch(() => { });
            return;
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

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Persist user message to IndexedDB
    saveMessage({
      id,
      role: "user",
      text,
      timestamp: Date.now(),
    }).catch(() => { });

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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[var(--background)]">
      {/* ── Header: Bridge URL config ── */}
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
                if (typeof window !== "undefined") {
                  console.log("[Claw] Reconnect clicked, bridgeUrl:", bridgeUrl.trim());
                }
                backoffMsRef.current = INITIAL_BACKOFF_MS;
                setReconnectKey((k) => k + 1);
              }}
              className="cursor-pointer rounded border border-amber-500/50 bg-amber-500/20 px-2 py-1 font-mono text-xs text-amber-200 hover:bg-amber-500/30"
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
        <div className="shrink-0 border-b border-amber-500/50 bg-amber-500/10 px-4 py-3">
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

      {/* ── Scrollable messages area ── */}
      <div ref={scrollContainerRef} data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Sentinel for infinite scroll-up */}
          <div ref={sentinelRef} className="h-px" />

          {isLoadingMore && (
            <p className="text-center font-mono text-xs text-gray-500 animate-pulse">
              Loading older messages…
            </p>
          )}

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
                {m.role === "assistant"
                  ? renderMarkdown(m.text)
                  : m.text}
              </div>
            </div>
          ))}

          {/* Anchor for auto-scroll to bottom */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t border-[var(--pixel-border)] bg-[var(--surface)] p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // Auto-resize
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message…"
            disabled={connectionStatus !== "connected"}
            rows={1}
            className="flex-1 resize-none rounded border border-[var(--pixel-border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-gray-500 focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 160 }}
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

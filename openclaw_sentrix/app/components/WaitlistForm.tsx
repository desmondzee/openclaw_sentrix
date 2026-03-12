"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(data.message ?? "You're in. We'll be in touch.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again?");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={status === "loading"}
          required
          className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-[var(--surface)] pixel-border text-[var(--foreground)] placeholder:text-gray-500 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all duration-200 font-mono text-sm"
          aria-label="Email for waitlist"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-3 rounded-lg bg-[var(--accent)] text-white font-[family-name:var(--font-pixel)] font-bold pixel-border-accent hover:bg-[var(--accent-dim)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shrink-0 cursor-pointer"
        >
          {status === "loading" ? "..." : "Join waitlist"}
        </button>
      </div>
      {message && (
        <p
          role="alert"
          className={`text-sm ${status === "success" ? "text-emerald-400" : "text-red-400"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

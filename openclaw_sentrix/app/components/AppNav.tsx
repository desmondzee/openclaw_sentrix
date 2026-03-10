"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function AppNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isClaw = pathname === "/claw";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--pixel-border)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link
          href="/"
          className={clsx(
            "font-[family-name:var(--font-pixel)] text-sm font-bold transition-colors",
            isHome ? "text-[var(--accent)]" : "text-[var(--foreground)] hover:text-[var(--accent-dim)]"
          )}
        >
          Sentrix
        </Link>
        <Link
          href="/claw"
          className={clsx(
            "font-[family-name:var(--font-pixel)] text-sm font-bold transition-colors",
            isClaw ? "text-[var(--accent)]" : "text-[var(--foreground)] hover:text-[var(--accent-dim)]"
          )}
        >
          Your Claw
        </Link>
      </div>
    </nav>
  );
}

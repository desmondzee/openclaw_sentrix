"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import { Terminal, Home, Star } from "lucide-react";
import Image from "next/image";

export function AppNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isClaw = pathname === "/claw";
  const [activeSection, setActiveSection] = useState<"home" | "install">("home");

  // Track scroll position to highlight Install when in that section
  useEffect(() => {
    if (!isHome) return;

    const handleScroll = () => {
      const installSection = document.getElementById("install");
      if (!installSection) return;

      const rect = installSection.getBoundingClientRect();
      const navHeight = 56; // Height of the nav
      
      // Consider "in install section" when the section top is near/past the nav
      // and the section bottom hasn't passed the viewport
      const isInInstall = rect.top <= navHeight + 100 && rect.bottom >= navHeight;
      
      setActiveSection(isInInstall ? "install" : "home");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToInstall = (e: React.MouseEvent) => {
    e.preventDefault();
    const installSection = document.getElementById("install");
    if (installSection) {
      const navHeight = 56;
      const rect = installSection.getBoundingClientRect();
      const scrollTop = window.pageYOffset + rect.top - navHeight - 20;
      window.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--pixel-border)] bg-[var(--background)]/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Left - Logo & Main Nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            onClick={scrollToTop}
            className="flex items-center gap-2 font-[family-name:var(--font-pixel)] text-lg font-bold text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors cursor-pointer select-none"
            draggable={false}
          >
            <div className="relative w-8 h-8 pointer-events-none select-none" draggable={false}>
              <Image
                src="/Sentrix_vector.png"
                alt="Sentrix"
                fill
                className="object-contain pointer-events-none select-none"
                draggable={false}
              />
            </div>
            <span className="select-none">Sentrix</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            <Link
              href="/"
              onClick={scrollToTop}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-all cursor-pointer",
                isHome && activeSection === "home"
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <button
              onClick={scrollToInstall}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-all cursor-pointer",
                isHome && activeSection === "install"
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Terminal className="w-4 h-4" />
              <span>Install</span>
            </button>
            <Link
              href="/claw"
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-all cursor-pointer",
                isClaw
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span>Claw</span>
            </Link>
          </div>
        </div>

        {/* Right - CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/desmondzee/openclaw_sentrix"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white font-mono text-sm transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <span>Star us</span>
          </Link>
          <Link
            href="/claw"
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white font-mono text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--accent)]/25 transition-all cursor-pointer"
          >
            <Star className="w-4 h-4 fill-white" />
            <span>Public Beta</span>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

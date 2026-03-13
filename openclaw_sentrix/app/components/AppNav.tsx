"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal, Home, Sparkles } from "lucide-react";
import Image from "next/image";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isClaw = pathname === "/claw";
  const [activeSection, setActiveSection] = useState<"home" | "install" | "claw">(isClaw ? "claw" : "home");
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const installRef = useRef<HTMLButtonElement>(null);
  const clawRef = useRef<HTMLAnchorElement>(null);

  // Update indicator position when active section changes
  useEffect(() => {
    const updateIndicator = () => {
      const targetRef = activeSection === "install" 
        ? installRef.current 
        : activeSection === "claw" 
          ? clawRef.current 
          : homeRef.current;

      if (targetRef && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect();
        const targetRect = targetRef.getBoundingClientRect();
        setIndicatorStyle({
          left: targetRect.left - navRect.left,
          width: targetRect.width,
        });
      }
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeSection]);

  // Track scroll position to highlight Install when in that section
  useEffect(() => {
    if (!isHome) return;

    const handleScroll = () => {
      const installSection = document.getElementById("install");
      if (!installSection) return;

      const rect = installSection.getBoundingClientRect();
      const navHeight = 56;
      
      const isInInstall = rect.top <= navHeight + 100 && rect.bottom >= navHeight;
      
      if (isInInstall && activeSection !== "install") {
        setActiveSection("install");
      } else if (!isInInstall && activeSection === "install") {
        setActiveSection("home");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome, activeSection]);

  const scrollToTop = () => {
    setActiveSection("home");
    if (!isHome) {
      // Navigate to home first, then scroll
      router.push("/");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToInstall = () => {
    setActiveSection("install");
    if (!isHome) {
      // Navigate to home first, then scroll to install section
      router.push("/#install");
    } else {
      const installSection = document.getElementById("install");
      if (installSection) {
        const navHeight = 56;
        const rect = installSection.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - navHeight - 20;
        window.scrollTo({ top: scrollTop, behavior: "smooth" });
      }
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

          <div ref={navRef} className="hidden sm:flex items-center gap-1 relative">
            {/* Sliding indicator */}
            <motion.div
              className="absolute h-8 bg-[var(--accent)]/10 rounded-md border border-[var(--accent)]/30"
              animate={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />

            <button
              ref={homeRef}
              onClick={scrollToTop}
              className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-colors cursor-pointer text-gray-400 hover:text-white"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              ref={installRef}
              onClick={scrollToInstall}
              className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-colors cursor-pointer text-gray-400 hover:text-white"
            >
              <Terminal className="w-4 h-4" />
              <span>Install</span>
            </button>
            <Link
              ref={clawRef}
              href="/claw"
              onClick={() => setActiveSection("claw")}
              className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm transition-colors cursor-pointer text-gray-400 hover:text-white"
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
            <Sparkles className="w-4 h-4" />
            <span>Public Beta</span>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

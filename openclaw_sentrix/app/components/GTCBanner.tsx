"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

export function GTCBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Hide banner after scrolling past 200px
      setIsScrolled(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && !isScrolled && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-[var(--accent)]/20 via-[var(--accent)]/10 to-[var(--accent)]/20 border-b border-[var(--accent)]/30 backdrop-blur-sm"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-mono text-[var(--accent)]">
              We&apos;re going to NVIDIA GTC 2026!
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-white/10 text-[var(--accent)]/70 hover:text-[var(--accent)] transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

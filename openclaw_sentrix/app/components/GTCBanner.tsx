"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function GTCBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Hide banner after scrolling past 400px
      setIsScrolled(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && !isScrolled && (
        <motion.a
          href="https://www.nvidia.com/gtc/"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-green-500/20 via-green-500/10 to-green-500/20 border-b border-green-500/30 backdrop-blur-sm cursor-pointer block"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
            <span className="text-sm font-mono text-green-400">
              We&apos;re going to NVIDIA GTC 2026!
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-white/10 text-green-400/70 hover:text-green-400 transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.a>
      )}
    </AnimatePresence>
  );
}

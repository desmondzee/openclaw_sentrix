"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";
import { AnimatedSprite } from "./AnimatedSprite";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative w-full flex flex-col items-center justify-center min-h-[90vh] px-6 text-center overflow-hidden pt-10">
      {/* Background Roaming Agents */}
      <AnimatedSprite
        spritesheet="/assets/patrol.png"
        width={48}
        height={64}
        className="opacity-30 pointer-events-none z-0"
        waypoints={[
          { x: -100, y: 100, duration: 15 },
          { x: 500, y: 100, duration: 15, delay: 2 },
          { x: 500, y: -50, duration: 8 },
          { x: -100, y: -50, duration: 15, delay: 1 }
        ]}
      />

      <AnimatedSprite
        spritesheet="/assets/investigator.png"
        width={40}
        height={48}
        className="opacity-20 pointer-events-none z-0 left-auto right-0"
        waypoints={[
          { x: 100, y: -100, duration: 15 },
          { x: -400, y: -100, duration: 15, delay: 3 },
          { x: -400, y: 50, duration: 8 },
          { x: 100, y: 50, duration: 15, delay: 1 }
        ]}
      />

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-6"
      >
        <Link
          href="/claw"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-full text-[var(--accent)] font-mono text-sm hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-all cursor-pointer group"
        >
          <Sparkles className="w-4 h-4" />
          <span>Now in Public Beta</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-4xl relative z-10"
      >
        <h1 className="font-[family-name:var(--font-pixel)] text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[var(--foreground)] drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">
          Sentrix
        </h1>
        <p className="mt-6 text-xl sm:text-2xl lg:text-3xl text-[var(--accent)] font-mono">
          Agentic police for your AI swarms.
        </p>
        <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Rogue agents are inevitable. We deploy patrols and investigators so your 
          autonomous AI stays in line — shielding you from data leaks, prompt injection, 
          and backdoors.
        </p>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-10 w-full flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10"
      >
        {/* Primary CTA - Public Beta */}
        <Link
          href="/claw"
          className="group inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent)] text-white font-mono font-semibold rounded-lg cursor-pointer hover:shadow-lg hover:shadow-[var(--accent)]/25 hover:bg-[var(--accent)]/90 transition-all duration-300"
        >
          <span>Public Beta</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* Secondary CTA - Documentation */}
        <a
          href="#install"
          className="inline-flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 text-gray-300 font-mono font-medium rounded-lg hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <span>Installation Guide</span>
        </a>
      </motion.div>

      {/* Waitlist Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-16 w-full max-w-md flex flex-col items-center relative z-10"
      >
        <p className="text-gray-500 text-sm mb-4 font-mono uppercase tracking-widest">
          Or join the waitlist for updates
        </p>
        <WaitlistForm />
      </motion.div>

      {/* Stats / Trust indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="mt-20 flex flex-wrap justify-center gap-8 sm:gap-16 relative z-10"
      >
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white font-[family-name:var(--font-pixel)]">80%</div>
          <div className="text-gray-500 text-xs sm:text-sm font-mono mt-1">Better Structure Accuracy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white font-[family-name:var(--font-pixel)]">30B</div>
          <div className="text-gray-500 text-xs sm:text-sm font-mono mt-1">Nemotron Parameters</div>
        </div>
        <div className="text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white font-[family-name:var(--font-pixel)]">&lt;100ms</div>
          <div className="text-gray-500 text-xs sm:text-sm font-mono mt-1">Patrol Response Time</div>
        </div>
      </motion.div>
    </section>
  );
}

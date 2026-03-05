"use client";

import { motion } from "framer-motion";
import { WaitlistForm } from "./WaitlistForm";
import { AnimatedSprite } from "./AnimatedSprite";

export function Hero() {
  return (
    <section className="relative w-full flex flex-col items-center justify-center min-h-[85vh] px-6 text-center overflow-hidden">
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl relative z-10"
      >
        <h1 className="font-[family-name:var(--font-pixel)] text-5xl sm:text-7xl font-bold tracking-tight text-[var(--foreground)] drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">
          Sentrix
        </h1>
        <p className="mt-6 text-xl sm:text-2xl text-[var(--accent)] font-mono">
          Agentic police for your AI swarms.
        </p>
        <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Rogue agents are inevitable. We deploy patrols and investigators so your autonomous AI stays in line — shielding you from data leaks, prompt injection, and backdoors.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-12 w-full flex flex-col items-center relative z-10"
      >
        <p className="text-gray-500 text-sm mb-4 font-mono uppercase tracking-widest">
          Secure Early Access
        </p>
        <WaitlistForm />
      </motion.div>
    </section>
  );
}

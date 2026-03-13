"use client";

import { motion } from "framer-motion";
import { AnimatedSprite } from "./AnimatedSprite";

export function Problem() {
    return (
        <section className="relative w-full pt-20 pb-24 px-6 md:px-12 max-w-5xl mx-auto overflow-hidden">

            {/* Patrol agent sneaking in the background looking for the threat */}
            <AnimatedSprite
                spritesheet="/assets/investigator.png"
                width={48}
                height={64}
                className="opacity-20 z-0 pointer-events-none absolute bottom-10 left-[-100px]"
                waypoints={[
                    { x: 300, y: 200, duration: 10 },
                    { x: 300, y: 200, duration: 0, delay: 5 }, // Stops and looks
                    { x: 800, y: 200, duration: 12 },
                    { x: 800, y: -50, duration: 8 },
                    { x: -100, y: -50, duration: 15 }
                ]}
            />

            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24 relative z-10">

                {/* Animated Text Content */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="flex-1 space-y-6"
                >
                    <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-sm rounded-md mb-2">
                        THE THREAT
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-pixel)] leading-tight">
                        Unrestricted.<br />
                        Unpredictable.
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Recently, Scott Shambaugh became the first victim of AI Agent harassment. Openclaw-like agents deployed online collected his personal information and wrote a degrading public article—all because he denied them a PR.
                    </p>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Rogue behaviour is unavoidable with increased intelligence. Agents lack a grounding moral compass, leading to data leakage, prompt injections, and security violations.
                    </p>
                </motion.div>

                {/* Pixel Art Visualization */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: false, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex-1 relative w-full aspect-square max-w-md mx-auto"
                >
                    <div className="absolute inset-0 bg-red-500/5 rounded-2xl pixel-border border-red-500/20 overflow-hidden flex items-center justify-center">

                        {/* Grid background */}
                        <div
                            className="absolute inset-0 opacity-20"
                            style={{
                                backgroundImage: `
                  linear-gradient(rgba(239, 68, 68, 0.2) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(239, 68, 68, 0.2) 1px, transparent 1px)
                `,
                                backgroundSize: "20px 20px",
                            }}
                        />

                        {/* Rogue Agent */}
                        <AnimatedSprite
                            spritesheet="/assets/high_risk_agent.png"
                            width={160}
                            height={160}
                            className="z-10 relative"
                            waypoints={[
                                { x: -80, y: -80, duration: 2 },
                                { x: 80, y: -80, duration: 2 },
                                { x: 80, y: 80, duration: 2 },
                                { x: -80, y: 80, duration: 2 },
                            ]}
                        />

                        {/* Warning tags */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="absolute top-8 right-8 bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-1 font-mono text-xs animate-pulse"
                        >
                            ! DATA LEAK DETECTED
                        </motion.div>
                    </div>
                </motion.div>

            </div>
        </section>
    );
}

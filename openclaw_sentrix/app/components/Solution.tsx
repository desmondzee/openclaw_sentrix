"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { AnimatedSprite } from "./AnimatedSprite";

export function Solution() {
    return (
        <section className="relative w-full py-32 px-6 overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--accent)]/5 to-transparent pointer-events-none" />

            <div className="max-w-6xl mx-auto flex flex-col items-center relative z-10">

                {/* Sneaky agent walking behind the control room */}
                <AnimatedSprite
                    spritesheet="/assets/normal_agent.png"
                    width={56}
                    height={72}
                    className="opacity-20 z-0 pointer-events-none absolute top-40 right-[-50px]"
                    waypoints={[
                        { x: -200, y: 100, duration: 15 },
                        { x: -200, y: 300, duration: 8 },
                        { x: -600, y: 300, duration: 15 },
                        { x: 100, y: 50, duration: 25, delay: 2 }
                    ]}
                />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mb-16"
                >
                    <div className="inline-block px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] font-mono text-sm rounded-md mb-4">
                        THE ARCHITECTURE
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-pixel)] leading-tight mb-6">
                        Meet Your New<br />Police Swarm.
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Sentrix is an end-to-end security solution deploying agentic police swarms. Modeled after real police investigation teams, we utilise multiple levels of escalation to ensure the security of autonomous AI systems.
                    </p>
                </motion.div>

                {/* The Swarm Visual representation */}
                <div className="relative w-full max-w-4xl bg-[var(--surface)] pixel-border rounded-xl p-8 shadow-2xl overflow-hidden mt-8">

                    <div className="absolute inset-0 opacity-10">
                        <Image
                            src="/assets/floor.png"
                            alt=""
                            fill
                            className="pixel-art object-cover"
                            unoptimized
                        />
                    </div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">

                        {/* Patrol */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col items-center text-center p-6 bg-black/40 pixel-border rounded-lg relative overflow-hidden"
                        >
                            <div className="w-24 h-24 relative mb-4 z-10">
                                <AnimatedSprite
                                    spritesheet="/assets/patrol.png"
                                    width={96}
                                    height={96}
                                    waypoints={[
                                        { x: -30, y: 0, duration: 3 },
                                        { x: 30, y: 0, duration: 3 },
                                        { x: 30, y: -10, duration: 1 },
                                        { x: -30, y: -10, duration: 3 },
                                    ]}
                                />
                            </div>
                            <h3 className="text-white font-bold font-mono text-lg mb-2 text-[var(--accent-dim)] relative z-10 mt-4">Patrols</h3>
                            <p className="text-gray-400 text-sm relative z-10">Constantly monitors tool calls, checking for leaked API keys or PII data in real time.</p>
                        </motion.div>

                        {/* Investigator */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-col items-center text-center p-6 bg-black/40 pixel-border border-[var(--accent)]/40 rounded-lg shadow-[0_0_15px_rgba(167,139,250,0.15)] transform md:-translate-y-4"
                        >
                            <div className="w-24 h-24 relative mb-4 z-10">
                                <AnimatedSprite
                                    spritesheet="/assets/investigator.png"
                                    width={96}
                                    height={96}
                                    waypoints={[
                                        { x: 0, y: 0, duration: 2, delay: 2 },
                                        { x: 0, y: 5, duration: 0.5 },
                                        { x: 0, y: 0, duration: 0.5, delay: 3 },
                                    ]}
                                />
                            </div>
                            <h3 className="text-white font-bold font-mono text-lg mb-2 text-[var(--accent)] relative mt-4">Investigators</h3>
                            <p className="text-gray-400 text-sm relative z-10">Powered by fine-tuned models to analyse case data and classify criminal behavior.</p>
                        </motion.div>

                        {/* Superintendent */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false }}
                            transition={{ delay: 0.6 }}
                            className="flex flex-col items-center text-center p-6 bg-black/40 pixel-border rounded-lg"
                        >
                            <div className="w-24 h-24 relative mb-4 z-10">
                                <AnimatedSprite
                                    spritesheet="/assets/superintendent.png"
                                    width={96}
                                    height={96}
                                    waypoints={[
                                        { x: 0, y: 0, duration: 4, delay: 4 },
                                        { x: 10, y: 0, duration: 1 },
                                        { x: -10, y: 0, duration: 2 },
                                        { x: 0, y: 0, duration: 1, delay: 2 }
                                    ]}
                                />
                            </div>
                            <h3 className="text-white font-bold font-mono text-lg mb-2 text-[var(--accent-dim)] relative mt-4">Superintendent</h3>
                            <p className="text-gray-400 text-sm relative z-10">Creates comprehensive case reports for human-in-the-loop escalation seamlessly.</p>
                        </motion.div>

                    </div>
                </div>

            </div>
        </section>
    );
}

"use client";

import { motion } from "framer-motion";
import { AnimatedSprite } from "./AnimatedSprite";
import { BackersMarquee } from "./BackersMarquee";

export function Tech() {
    return (
        <section className="relative w-full py-24 px-6 md:px-12 max-w-4xl mx-auto text-center overflow-hidden">
            {/* Witty background agent reading the tech specs */}
            <AnimatedSprite
                spritesheet="/assets/network.png"
                width={48}
                height={48}
                className="opacity-40 z-0 pointer-events-none"
                waypoints={[
                    { x: -100, y: 150, duration: 20 },
                    { x: 400, y: 150, duration: 15, delay: 4 },
                    { x: 400, y: 50, duration: 8 },
                    { x: -100, y: 50, duration: 15, delay: 2 }
                ]}
            />
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="space-y-8"
            >
                <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-sm rounded-md mb-2">
                    THE ENGINE
                </div>
                <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-pixel)] leading-tight">
                    Powered by Nemotron.
                </h2>

                <p className="text-gray-400 text-lg leading-relaxed max-w-3xl mx-auto">
                    We used the Nvidia Nemotron stack, developing sophisticated synthetic data generation (SDG) pipelines for supervised fine-tuning (SFT) of our Nemotron 3.3 30B investigative agents.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left">
                    <div className="bg-[var(--surface)] p-6 rounded-xl pixel-border">
                        <h4 className="text-[var(--accent)] font-mono font-bold mb-2">Metrics Improvement</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm text-gray-400 mb-1">
                                    <span>Structure Accuracy</span>
                                    <span className="text-green-400">+80%</span>
                                </div>
                                <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: "80%" }}
                                        viewport={{ once: false }}
                                        transition={{ duration: 1, delay: 0.5 }}
                                        className="bg-green-500 h-full"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm text-gray-400 mb-1">
                                    <span>Reasoning Accuracy</span>
                                    <span className="text-green-400">+5%</span>
                                </div>
                                <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: "20%" }}
                                        viewport={{ once: false }}
                                        transition={{ duration: 1, delay: 0.7 }}
                                        className="bg-green-500 h-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--surface)] p-6 rounded-xl pixel-border flex flex-col justify-center">
                        <h4 className="text-[var(--accent)] font-mono font-bold mb-2">Training Performance</h4>
                        <p className="text-gray-400 text-sm mb-4">
                            Using supervised fine-tuning with LoRA over 3 epochs, training loss plummeted while token-level accuracy skyrocketed.
                        </p>
                        <ul className="space-y-2 font-mono text-sm">
                            <li className="flex justify-between">
                                <span className="text-gray-500">Loss</span>
                                <span className="text-white">10.93 → 1.59</span>
                            </li>
                            <li className="flex justify-between">
                                <span className="text-gray-500">Token Accuracy</span>
                                <span className="text-white">48.8% → 87.7%</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Backers Marquee */}
                <BackersMarquee />
            </motion.div>
        </section>
    );
}

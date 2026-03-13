"use client";

import { motion } from "framer-motion";

const backers = [
  { name: "NVIDIA" },
  { name: "Dawn Capital" },
  { name: "Entrepreneurs First" },
  { name: "Tracer" },
  { name: "Odin" },
  { name: "Prolific" },
  { name: "Crane" },
  { name: "Cooley" },
  { name: "Encord" },
  { name: "N47" },
  { name: "Doubleword" },
  { name: "UCL" },
  { name: "Cambridge" },
  { name: "Granola" },
];

function BackerItem({ name }: { name: string }) {
  return (
    <div className="flex-shrink-0 px-3 py-3">
      <div className="px-5 py-2.5 rounded-lg font-mono text-sm text-gray-400 whitespace-nowrap hover:border-[var(--accent)]/50 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 border border-transparent hover:border-[var(--accent)]/50 transition-all cursor-pointer">
        {name}
      </div>
    </div>
  );
}

export function BackersMarquee() {
  // Duplicate the backers array for seamless loop
  const duplicatedBackers = [...backers, ...backers];

  return (
    <div className="w-full mt-16 mb-16">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.5 }}
        className="flex justify-center mb-6"
      >
        <div className="inline-block px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] font-mono text-sm rounded-md">
          Idea backed by
        </div>
      </motion.div>

      <div className="relative overflow-hidden">
        {/* Gradient masks for smooth fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--background)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--background)] to-transparent z-10 pointer-events-none" />

        {/* Scrolling container */}
        <motion.div
          className="flex"
          animate={{
            x: [0, -50 * backers.length * 2],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 30,
              ease: "linear",
            },
          }}
        >
          {duplicatedBackers.map((backer, index) => (
            <BackerItem key={`${backer.name}-${index}`} name={backer.name} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

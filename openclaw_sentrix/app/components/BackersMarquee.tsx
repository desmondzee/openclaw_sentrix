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
    <div className="flex-shrink-0 px-8 py-3">
      <span className="text-gray-500/60 font-mono text-sm whitespace-nowrap hover:text-gray-400 transition-colors cursor-default">
        {name}
      </span>
    </div>
  );
}

export function BackersMarquee() {
  // Duplicate the backers array for seamless loop
  const duplicatedBackers = [...backers, ...backers];

  return (
    <div className="w-full mt-16">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.5 }}
        className="text-center font-mono text-xs text-gray-600 uppercase tracking-widest mb-6"
      >
        Idea backed by
      </motion.p>

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

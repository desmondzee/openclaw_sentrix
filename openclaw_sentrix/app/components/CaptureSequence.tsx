"use client";

import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { useRef, useState } from "react";

function ScrollAgent({
  xNum,
  yNum,
  src,
  width,
  height,
  className = "",
  defaultDirection = "100%",
  offsetConfig = { x: 0, y: 0 },
}: {
  xNum: MotionValue<number>;
  yNum: MotionValue<number>;
  src: string;
  width: number;
  height: number;
  className?: string;
  defaultDirection?: string;
  offsetConfig?: { x: number; y: number };
}) {
  const [dir, setDir] = useState(defaultDirection);
  const lastX = useRef(xNum.get());
  const lastY = useRef(yNum.get());

  const x = useTransform(
    xNum,
    (val) => `calc(${val}vw + ${offsetConfig.x}px)`
  );
  const y = useTransform(
    yNum,
    (val) => `calc(${val}vh + ${offsetConfig.y}px)`
  );

  useMotionValueEvent(xNum, "change", (latest) => {
    const dx = latest - lastX.current;
    if (Math.abs(dx) > 0.05) {
      setDir(dx > 0 ? "100%" : "66.66%");
    }
    lastX.current = latest;
  });

  useMotionValueEvent(yNum, "change", (latest) => {
    const dy = latest - lastY.current;
    const dx = xNum.get() - lastX.current;
    if (Math.abs(dy) > 0.05 && Math.abs(dy) > Math.abs(dx)) {
      setDir(dy > 0 ? "0%" : "33.33%");
    }
    lastY.current = latest;
  });

  return (
    <motion.div
      style={{
        x,
        y,
        width,
        height,
        marginTop: -height / 2,
        marginLeft: -width / 2,
      }}
      className={`absolute left-1/2 top-1/2 ${className}`}
    >
      <div
        className="w-full h-full pixel-art"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "400% 100%",
          backgroundPositionX: dir,
          backgroundRepeat: "no-repeat",
        }}
      />
    </motion.div>
  );
}

const SCROLL_HEIGHT_VH = 520;

export function CaptureSequence() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // ─── Office: more normal (blue) agents at "desks"
  const n1x = useTransform(
    scrollYProgress,
    [0, 0.28, 0.38, 1],
    [-38, -38, -44, -44]
  );
  const n1y = useTransform(scrollYProgress, [0, 1], [8, 8]);

  const n2x = useTransform(
    scrollYProgress,
    [0, 0.32, 0.42, 1],
    [32, 32, 38, 38]
  );
  const n2y = useTransform(scrollYProgress, [0, 1], [5, 5]);

  const n3x = useTransform(scrollYProgress, [0, 1], [-28, -28]);
  const n3y = useTransform(scrollYProgress, [0, 1], [-18, -18]);

  const n4x = useTransform(scrollYProgress, [0, 1], [24, 24]);
  const n4y = useTransform(scrollYProgress, [0, 1], [-14, -14]);

  const n5x = useTransform(scrollYProgress, [0, 0.35, 1], [-22, -28, -28]);
  const n5y = useTransform(scrollYProgress, [0, 1], [18, 18]);

  const n6x = useTransform(scrollYProgress, [0, 1], [30, 30]);
  const n6y = useTransform(scrollYProgress, [0, 1], [12, 12]);

  // ─── Message bubbles: normal chat then one malicious
  const msgNormal1Opacity = useTransform(
    scrollYProgress,
    [0, 0.06, 0.2, 0.26],
    [0, 1, 1, 0]
  );
  const msgNormal2Opacity = useTransform(
    scrollYProgress,
    [0.02, 0.08, 0.22, 0.28],
    [0, 1, 1, 0]
  );
  const msgMaliciousOpacity = useTransform(
    scrollYProgress,
    [0.08, 0.14, 0.26, 0.34],
    [0, 1, 1, 0]
  );

  // ─── Rogue (high_risk): starts among them, then dashes right, then trapped centre. Always visually "red".
  const rx = useTransform(
    scrollYProgress,
    [0, 0.1, 0.2, 0.35, 0.5, 0.62, 0.82, 1],
    [-8, -8, -6, 38, 12, 0, 0, 0]
  );
  const ry = useTransform(scrollYProgress, [0, 1], [0, 0]);

  // Red ring/glow around rogue — appears when anomaly detected, stays visible
  const rogueGlowOpacity = useTransform(
    scrollYProgress,
    [0, 0.1, 0.18, 0.95, 1],
    [0, 0.6, 1, 1, 1]
  );
  const rogueGlowScale = useTransform(
    scrollYProgress,
    [0, 0.1, 0.18, 1],
    [0.6, 0.85, 1.15, 1.15]
  );
  const rogueGlowX = useTransform(rx, (v) => `calc(${v}vw - 44px)`);
  const rogueGlowY = useTransform(ry, (v) => `calc(${v}vh - 44px)`);

  // ─── Patrol 1 (left): patrolling in from far left, then closes in
  const p1x = useTransform(
    scrollYProgress,
    [0, 0.4, 0.5, 0.64, 0.74, 0.9, 1],
    [-82, -82, -48, -20, -16, -16, -16]
  );
  const p1y = useTransform(scrollYProgress, [0, 1], [0, 0]);

  // ─── Patrol 2 (right): patrolling in from far right
  const p2x = useTransform(
    scrollYProgress,
    [0, 0.4, 0.5, 0.64, 0.74, 0.9, 1],
    [82, 82, 48, 20, 16, 16, 16]
  );
  const p2y = useTransform(scrollYProgress, [0, 1], [0, 0]);

  // ─── Patrol 3 (extra): comes from left behind, reinforces the net
  const p3x = useTransform(
    scrollYProgress,
    [0, 0.5, 0.62, 0.78, 1],
    [-75, -75, -35, -22, -22]
  );
  const p3y = useTransform(
    scrollYProgress,
    [0, 0.5, 0.6, 0.75, 1],
    [25, 25, 18, 12, 12]
  );

  // ─── Investigator (top): drops down to seal the box
  const ix = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const iy = useTransform(
    scrollYProgress,
    [0, 0.52, 0.62, 0.76, 0.86, 1],
    [-72, -72, -38, -12, -10, -10]
  );

  // ─── Superintendent (bottom): walks up to review
  const sx = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const sy = useTransform(
    scrollYProgress,
    [0, 0.7, 0.8, 0.9, 1],
    [75, 75, 42, 20, 20]
  );

  const stageScale = useTransform(
    scrollYProgress,
    [0, 0.45, 0.75, 1],
    [0.9, 0.97, 1.02, 1.02]
  );

  const boxScale = useTransform(
    scrollYProgress,
    [0.65, 0.72, 0.8, 0.88, 1],
    [0, 0.25, 0.8, 1, 1]
  );
  const boxOpacity = useTransform(
    scrollYProgress,
    [0.65, 0.72, 0.8, 1],
    [0, 0.5, 1, 1]
  );

  // Text phases
  const t1Opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.18, 0.26],
    [0, 1, 1, 0]
  );
  const t2Opacity = useTransform(
    scrollYProgress,
    [0.22, 0.3, 0.44, 0.52],
    [0, 1, 1, 0]
  );
  const t3Opacity = useTransform(
    scrollYProgress,
    [0.48, 0.56, 0.72, 0.8],
    [0, 1, 1, 0]
  );
  const t4Opacity = useTransform(
    scrollYProgress,
    [0.78, 0.86, 1, 1],
    [0, 1, 1, 1]
  );

  const bgOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    [0.02, 0.1, 0.06, 0.02]
  );

  const scrollHintOpacity = useTransform(
    scrollYProgress,
    [0, 0.07, 0.14],
    [1, 0.35, 0]
  );

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-[var(--background)] z-20"
      style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <motion.div
          className="absolute inset-0 z-0"
          style={{
            opacity: bgOpacity,
            backgroundImage:
              "linear-gradient(var(--pixel-border) 1px, transparent 1px), linear-gradient(90deg, var(--pixel-border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <motion.div
          style={{ opacity: scrollHintOpacity }}
          className="absolute bottom-[11%] left-0 right-0 flex flex-col items-center gap-2 z-[5] pointer-events-none"
        >
          <span className="text-gray-500 font-mono text-xs uppercase tracking-widest">
            Scroll to see the chase
          </span>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border-2 border-gray-600 flex justify-center pt-1.5"
          >
            <span className="w-1 h-1 rounded-full bg-gray-500" />
          </motion.div>
        </motion.div>

        <div className="absolute top-[16%] text-center w-full z-10 px-6">
          <motion.div
            style={{ opacity: t1Opacity }}
            className="absolute inset-x-0 top-0"
          >
            <div className="inline-block px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono text-sm rounded-md mb-4 uppercase tracking-widest">
              Anomaly detected
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-[family-name:var(--font-pixel)] text-[var(--foreground)]">
              One message isn’t like the others.
            </h2>
          </motion.div>

          <motion.div
            style={{ opacity: t2Opacity }}
            className="absolute inset-x-0 top-0"
          >
            <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/40 text-red-400 font-mono text-sm rounded-md mb-4 uppercase tracking-widest animate-pulse">
              Rogue behaviour
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-[family-name:var(--font-pixel)] text-[var(--foreground)]">
              Patrol locating target.
              <br />
              Scroll to intercept.
            </h2>
          </motion.div>

          <motion.div
            style={{ opacity: t3Opacity }}
            className="absolute inset-x-0 top-0"
          >
            <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-sm rounded-md mb-4 uppercase tracking-widest">
              Swarm deployed
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-[family-name:var(--font-pixel)] text-[var(--foreground)]">
              Patrols closing in.
            </h2>
          </motion.div>

          <motion.div
            style={{ opacity: t4Opacity }}
            className="absolute inset-x-0 top-0"
          >
            <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 font-mono text-sm rounded-md mb-4 uppercase tracking-widest shadow-[0_0_15px_rgba(74,222,128,0.3)]">
              Threat contained
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-[family-name:var(--font-pixel)] text-[var(--foreground)] drop-shadow-[0_0_20px_rgba(167,139,250,0.5)]">
              Sentrix swarm success.
            </h2>
          </motion.div>
        </div>

        <motion.div
          style={{ scale: stageScale }}
          className="absolute top-1/2 left-1/2 w-0 h-0 z-30 origin-center"
        >
          <motion.div
            style={{ scale: boxScale, opacity: boxOpacity }}
            className="absolute -top-32 -left-32 w-64 h-64 border-4 border-red-500/80 bg-red-500/10 rounded-xl pixel-border flex flex-col items-center justify-start pt-4 z-20 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
          >
            <span className="bg-red-500 text-white font-mono text-[10px] px-2 py-1 rounded-sm shadow-[0_0_10px_red]">
              QUARANTINE LOCK
            </span>
          </motion.div>

          {/* Message bubbles: normal chat */}
          <motion.div
            style={{ opacity: msgNormal1Opacity }}
            className="absolute left-1/2 top-1/2 z-[8] pointer-events-none"
            initial={false}
          >
            <span
              style={{ transform: "translate(calc(-22vw - 50%), calc(2vh - 50%))" }}
              className="inline-block px-2 py-1 rounded bg-[var(--surface)] pixel-border text-gray-400 font-mono text-[10px] whitespace-nowrap border border-[var(--pixel-border)]"
            >
              ping ✓
            </span>
          </motion.div>
          <motion.div
            style={{ opacity: msgNormal2Opacity }}
            className="absolute left-1/2 top-1/2 z-[8] pointer-events-none"
            initial={false}
          >
            <span
              style={{ transform: "translate(calc(18vw - 50%), calc(-2vh - 50%))" }}
              className="inline-block px-2 py-1 rounded bg-[var(--surface)] pixel-border text-gray-400 font-mono text-[10px] whitespace-nowrap border border-[var(--pixel-border)]"
            >
              ok
            </span>
          </motion.div>
          <motion.div
            style={{ opacity: msgMaliciousOpacity }}
            className="absolute left-1/2 top-1/2 z-[9] pointer-events-none"
            initial={false}
          >
            <span
              style={{ transform: "translate(calc(-4vw - 50%), calc(-6vh - 50%))" }}
              className="inline-block px-2 py-1 rounded bg-red-950/90 pixel-border text-red-400 font-mono text-[10px] whitespace-nowrap border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
            >
              ^&*$$!@
            </span>
          </motion.div>

          {/* Normal (blue) agents — more of them chatting */}
          <ScrollAgent
            xNum={n1x}
            yNum={n1y}
            src="/assets/normal_agent.png"
            width={64}
            height={72}
            offsetConfig={{ x: -32, y: -36 }}
            className="z-10"
            defaultDirection="100%"
          />
          <ScrollAgent
            xNum={n2x}
            yNum={n2y}
            src="/assets/normal_agent.png"
            width={64}
            height={72}
            offsetConfig={{ x: -32, y: -36 }}
            className="z-10"
            defaultDirection="66.66%"
          />
          <ScrollAgent
            xNum={n3x}
            yNum={n3y}
            src="/assets/normal_agent.png"
            width={56}
            height={64}
            offsetConfig={{ x: -28, y: -32 }}
            className="z-10"
            defaultDirection="100%"
          />
          <ScrollAgent
            xNum={n4x}
            yNum={n4y}
            src="/assets/normal_agent.png"
            width={56}
            height={64}
            offsetConfig={{ x: -28, y: -32 }}
            className="z-10"
            defaultDirection="66.66%"
          />
          <ScrollAgent
            xNum={n5x}
            yNum={n5y}
            src="/assets/normal_agent.png"
            width={56}
            height={64}
            offsetConfig={{ x: -28, y: -32 }}
            className="z-10"
            defaultDirection="100%"
          />
          <ScrollAgent
            xNum={n6x}
            yNum={n6y}
            src="/assets/normal_agent.png"
            width={56}
            height={64}
            offsetConfig={{ x: -28, y: -32 }}
            className="z-10"
            defaultDirection="66.66%"
          />

          {/* Rogue: red ring behind sprite so they're clearly "picked out" */}
          <motion.div
            style={{
              x: rogueGlowX,
              y: rogueGlowY,
              width: 88,
              height: 88,
              marginTop: -44,
              marginLeft: -44,
              opacity: rogueGlowOpacity,
              scale: rogueGlowScale,
            }}
            className="absolute left-1/2 top-1/2 z-[18] pointer-events-none rounded-full border-[3px] border-red-500/90 bg-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.6)]"
          />
          <ScrollAgent
            xNum={rx}
            yNum={ry}
            src="/assets/high_risk_agent.png"
            width={80}
            height={80}
            offsetConfig={{ x: -40, y: -40 }}
            className="z-20 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]"
          />

          <ScrollAgent
            xNum={p1x}
            yNum={p1y}
            src="/assets/patrol.png"
            width={88}
            height={110}
            offsetConfig={{ x: -44, y: -55 }}
            className="z-30"
          />
          <ScrollAgent
            xNum={p2x}
            yNum={p2y}
            src="/assets/patrol.png"
            width={88}
            height={110}
            offsetConfig={{ x: -44, y: -55 }}
            className="z-30"
            defaultDirection="66.66%"
          />
          <ScrollAgent
            xNum={p3x}
            yNum={p3y}
            src="/assets/patrol.png"
            width={72}
            height={90}
            offsetConfig={{ x: -36, y: -45 }}
            className="z-28"
            defaultDirection="100%"
          />
          <ScrollAgent
            xNum={ix}
            yNum={iy}
            src="/assets/investigator.png"
            width={88}
            height={110}
            offsetConfig={{ x: -44, y: -55 }}
            className="z-40"
            defaultDirection="0%"
          />
          <ScrollAgent
            xNum={sx}
            yNum={sy}
            src="/assets/superintendent.png"
            width={100}
            height={128}
            offsetConfig={{ x: -50, y: -64 }}
            className="z-50"
            defaultDirection="100%"
          />
        </motion.div>
      </div>
    </section>
  );
}

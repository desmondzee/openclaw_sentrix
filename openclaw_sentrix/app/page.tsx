import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { Solution } from "./components/Solution";
import { Tech } from "./components/Tech";
import { WaitlistForm } from "./components/WaitlistForm";
import { AnimatedSprite } from "./components/AnimatedSprite";
import { CaptureSequence } from "./components/CaptureSequence";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {/* Subtle grid background that stays fixed */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--pixel-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--pixel-border) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />

      <main className="relative z-10 flex flex-col items-center">
        <div data-snap-section className="min-h-screen w-full">
          <Hero />
        </div>
        <div data-snap-section className="w-full">
          <Problem />
        </div>
        <div data-snap-section className="w-full shrink-0">
          <CaptureSequence />
        </div>
        <div data-snap-section className="w-full">
          <Solution />
        </div>
        <div data-snap-section id="nemotron-section" className="w-full">
          <Tech />
        </div>

        {/* Final CTA — no snap so user scrolls freely to waitlist */}
        <section className="relative w-full min-h-[50vh] py-24 px-6 flex flex-col items-center justify-center text-center overflow-hidden">

          <AnimatedSprite
            spritesheet="/assets/normal_agent.png"
            width={48}
            height={64}
            className="opacity-30 z-0 pointer-events-none absolute left-[10%]"
            waypoints={[
              { x: 100, y: -50, duration: 8 },
              { x: 200, y: 0, duration: 10 },
              { x: -50, y: 50, duration: 15 },
              { x: -50, y: -50, duration: 10 }
            ]}
          />

          <AnimatedSprite
            spritesheet="/assets/patrol.png"
            width={56}
            height={72}
            className="opacity-25 z-0 pointer-events-none absolute right-[10%] top-[40%]"
            waypoints={[
              { x: -150, y: 20, duration: 12 },
              { x: -300, y: -40, duration: 10 },
              { x: 50, y: -40, duration: 15 },
              { x: 50, y: 20, duration: 10 }
            ]}
          />

          <AnimatedSprite
            spritesheet="/assets/investigator.png"
            width={40}
            height={56}
            className="opacity-15 z-0 pointer-events-none absolute left-[50%] top-[10%]"
            waypoints={[
              { x: 0, y: 150, duration: 15 },
              { x: -100, y: 150, duration: 5 },
              { x: -100, y: 0, duration: 15 },
              { x: 0, y: 0, duration: 5 }
            ]}
          />

          <div className="relative z-10">
            <h2 className="text-3xl font-bold font-[family-name:var(--font-pixel)] mb-8">
              Ready to secure your swarm?
            </h2>
            <WaitlistForm />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--pixel-border)] mt-auto py-8 text-center text-gray-500 font-mono text-sm">
        <p>© {new Date().getFullYear()} Sentrix Swarms. All rights reserved.</p>
        <div className="mt-4 flex justify-center gap-4">
          <a href="https://huggingface.co/akoniti/nemotron_3.3_30B_A3B_malicious_message_intent" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">
            HuggingFace Models
          </a>
        </div>
      </footer>
    </div>
  );
}

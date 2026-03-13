import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { Solution } from "./components/Solution";
import { Tech } from "./components/Tech";
import { InstallationGuide } from "./components/InstallationGuide";
import { Footer } from "./components/Footer";
import { WaitlistForm } from "./components/WaitlistForm";
import { AnimatedSprite } from "./components/AnimatedSprite";
import { CaptureSequence } from "./components/CaptureSequence";
import { GTCBanner } from "./components/GTCBanner";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <GTCBanner />
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
        {/* Hero Section */}
        <section data-snap-section className="min-h-screen w-full">
          <Hero />
        </section>

        {/* Problem Section */}
        <section data-snap-section className="w-full">
          <Problem />
        </section>

        {/* Capture Sequence Demo */}
        <section data-snap-section className="w-full shrink-0">
          <CaptureSequence />
        </section>

        {/* Solution Section */}
        <section data-snap-section className="w-full">
          <Solution />
        </section>

        {/* Installation Guide */}
        <section data-snap-section id="install" className="w-full bg-gradient-to-b from-transparent via-[var(--accent)]/5 to-transparent py-16">
          <InstallationGuide />
        </section>

        {/* Tech Stack Section */}
        <section data-snap-section id="nemotron-section" className="w-full">
          <Tech />
        </section>

        {/* Final CTA Section */}
        <section className="relative w-full min-h-[60vh] py-24 px-6 flex flex-col items-center justify-center text-center overflow-hidden">
          {/* Background animated sprites */}
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

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-pixel)] mb-6">
              Ready to secure your swarm?
            </h2>
            <p className="text-gray-400 text-lg mb-10">
              Join the growing number of organizations trusting Sentrix to keep their 
              AI agents in check. Deploy your police force today.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/claw"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent)] text-white font-mono font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--accent)]/25 transition-all cursor-pointer"
              >
                Public Beta
              </a>
              <a
                href="https://pypi.org/project/openclaw-sentrix/#description"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 text-gray-300 font-mono font-medium rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                Read Documentation
              </a>
            </div>

            <div className="mt-12">
              <p className="text-gray-500 text-sm mb-4 font-mono uppercase tracking-widest">
                Get early access updates
              </p>
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

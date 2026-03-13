"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Apple, Monitor, Terminal, Copy, Check, Container } from "lucide-react";

type OS = "macos" | "windows" | "linux";

interface InstallStep {
  title: string;
  command?: string;
  description: string;
  icon?: React.ReactNode;
}

const installSteps: Record<OS, InstallStep[]> = {
  macos: [
    {
      title: "Install Sentrix",
      command: "pip install openclaw-sentrix",
      description: "Or use uv for faster installs: uv pip install openclaw-sentrix",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Ensure Docker Desktop is running",
      description: "Download from docker.com if you haven't installed it yet.",
      icon: <Container className="w-4 h-4" />,
    },
    {
      title: "Build the sandbox",
      command: "sentrix build",
      description: "This sets up your isolated agent environment.",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Launch Sentrix",
      command: "sentrix run",
      description: "Your agent police force is now active.",
      icon: <Terminal className="w-4 h-4" />,
    },
  ],
  windows: [
    {
      title: "Install Sentrix",
      command: "pip install openclaw-sentrix",
      description: "Or use uv: uv pip install openclaw-sentrix (PowerShell recommended)",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Ensure Docker Desktop is running",
      description: "Download from docker.com. WSL2 backend recommended for best performance.",
      icon: <Container className="w-4 h-4" />,
    },
    {
      title: "Build the sandbox",
      command: "sentrix build",
      description: "This sets up your isolated agent environment.",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Launch Sentrix",
      command: "sentrix run",
      description: "Your agent police force is now active.",
      icon: <Terminal className="w-4 h-4" />,
    },
  ],
  linux: [
    {
      title: "Install Sentrix",
      command: "pip install openclaw-sentrix",
      description: "Or use uv: uv pip install openclaw-sentrix",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Ensure Docker is installed",
      command: "sudo apt-get install docker.io",
      description: "Or use your distro's package manager.",
      icon: <Container className="w-4 h-4" />,
    },
    {
      title: "Build the sandbox",
      command: "sentrix build",
      description: "This sets up your isolated agent environment.",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      title: "Launch Sentrix",
      command: "sentrix run",
      description: "Your agent police force is now active.",
      icon: <Terminal className="w-4 h-4" />,
    },
  ],
};

const osTabs: { id: OS; label: string; icon: React.ReactNode }[] = [
  { id: "macos", label: "macOS", icon: <Apple className="w-4 h-4" /> },
  { id: "windows", label: "Windows", icon: <Monitor className="w-4 h-4" /> },
  { id: "linux", label: "Linux", icon: <Terminal className="w-4 h-4" /> },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-md bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group"
      aria-label="Copy to clipboard"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Check className="w-4 h-4 text-green-400" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Copy className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

export function InstallationGuide() {
  const [activeOS, setActiveOS] = useState<OS>("macos");

  return (
    <section className="relative w-full py-24 px-6 md:px-12 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <div className="inline-block px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] font-mono text-sm rounded-md mb-4">
          GET STARTED
        </div>
        <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-pixel)] leading-tight mb-4">
          Deploy in minutes.
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Get your agent police force up and running with just a few commands.
        </p>
      </motion.div>

      {/* OS Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex justify-center mb-8"
      >
        <div className="inline-flex bg-[var(--surface)] p-1 rounded-lg pixel-border">
          {osTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveOS(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-mono text-sm transition-all duration-300 cursor-pointer ${
                activeOS === tab.id
                  ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Installation Steps */}
      <motion.div
        key={activeOS}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[var(--surface)] pixel-border rounded-xl overflow-hidden"
      >
        <div className="p-6 space-y-6">
          {installSteps[activeOS].map((step, index) => (
            <motion.div
              key={`${activeOS}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex gap-4"
            >
              {/* Step Number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-mono text-sm font-bold">
                {index + 1}
              </div>

              {/* Step Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">{step.icon}</span>
                  <h3 className="text-white font-mono font-semibold">{step.title}</h3>
                </div>
                <p className="text-gray-400 text-sm">{step.description}</p>
                {step.command && (
                  <div className="mt-3 flex items-center gap-2 bg-black/50 rounded-lg p-3 border border-white/5">
                    <code className="flex-1 font-mono text-sm text-green-400 overflow-x-auto">
                      {step.command}
                    </code>
                    <CopyButton text={step.command} />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-4 bg-black/30 border-t border-white/5">
          <p className="text-gray-500 text-xs font-mono text-center">
            Requires Python 3.10+ and Docker Desktop.{" "}
            <a
              href="https://pypi.org/project/openclaw-sentrix/#description"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline cursor-pointer"
            >
              View full documentation →
            </a>
          </p>
        </div>
      </motion.div>
    </section>
  );
}

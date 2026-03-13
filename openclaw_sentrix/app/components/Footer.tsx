"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Github, Twitter, Linkedin, Mail, ExternalLink } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Documentation", href: "https://docs.openclaw-sentrix.ai", external: true },
    { label: "API Reference", href: "#api", external: true },
    { label: "Changelog", href: "#changelog" },
  ],
  company: [
    { label: "About", href: "#about" },
    { label: "Blog", href: "#blog" },
    { label: "Careers", href: "#careers" },
    { label: "Contact", href: "mailto:hello@sentrix.ai" },
  ],
  resources: [
    { label: "Community", href: "#community" },
    { label: "GitHub", href: "https://github.com/desmondzee/openclaw_sentrix", external: true },
    { label: "HuggingFace", href: "https://huggingface.co/akoniti", external: true },
    { label: "Status", href: "#status" },
  ],
};

const backers = [
  { name: "NVIDIA", tier: "technology" },
  { name: "Dawn Capital", tier: "investor" },
  { name: "Entrepreneurs First", tier: "investor" },
  { name: "Tracer", tier: "investor" },
  { name: "Odin", tier: "investor" },
  { name: "Prolific", tier: "partner" },
  { name: "Crane", tier: "investor" },
  { name: "Cooley", tier: "partner" },
  { name: "Encord", tier: "partner" },
  { name: "N47", tier: "investor" },
  { name: "Doubleword", tier: "partner" },
  { name: "UCL", tier: "academic" },
  { name: "Cambridge", tier: "academic" },
  { name: "Granola", tier: "partner" },
];

const foundingTeam = [
  { 
    name: "Shashank", 
    role: "CEO & Co-founder",
    bio: "Former police officer with deep expertise in forensics and law enforcement.",
    linkedin: "#",
    twitter: "#"
  },
  { 
    name: "J", 
    role: "CTO & Co-founder",
    bio: "AI researcher specializing in multi-agent systems and synthetic data generation.",
    linkedin: "#",
    github: "#"
  },
  { 
    name: "S", 
    role: "Chief Scientist",
    bio: "PhD in ML. Led training of Nemotron-based investigative agents.",
    linkedin: "#",
    github: "#"
  },
  { 
    name: "L", 
    role: "Head of Engineering",
    bio: "Built scalable agent orchestration systems at leading tech companies.",
    linkedin: "#",
    github: "#"
  },
];

function BackerLogo({ name, tier }: { name: string; tier: string }) {
  const tierStyles: Record<string, string> = {
    technology: "text-white font-bold",
    investor: "text-gray-300",
    partner: "text-gray-400",
    academic: "text-gray-400 italic",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`px-4 py-2 bg-white/5 rounded-lg border border-white/10 font-mono text-sm whitespace-nowrap cursor-pointer hover:bg-white/10 transition-colors ${tierStyles[tier]}`}
      title={`${name} — ${tier}`}
    >
      {name}
    </motion.div>
  );
}

export function Footer() {
  return (
    <footer className="relative w-full border-t border-[var(--pixel-border)] bg-[var(--surface)]/50">
      {/* Main Footer Content */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 space-y-4"
          >
            <Link href="/" className="inline-block">
              <span className="font-[family-name:var(--font-pixel)] text-2xl font-bold text-[var(--accent)]">
                Sentrix
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Next-generational agentic police force designed to protect you and your 
              organisations when deploying agentic workflows. Because rogue agent 
              behaviour is inevitable — but manageable.
            </p>
            <div className="flex gap-3 pt-2">
              <a
                href="https://github.com/desmondzee/openclaw_sentrix"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com/sentrix"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/company/sentrix"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="mailto:hello@sentrix.ai"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Product Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h4 className="font-mono font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-gray-400 hover:text-[var(--accent)] text-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    {link.label}
                    {link.external && <ExternalLink className="w-3 h-3" />}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 className="font-mono font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-[var(--accent)] text-sm transition-colors cursor-pointer"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Resources Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h4 className="font-mono font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-gray-400 hover:text-[var(--accent)] text-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    {link.label}
                    {link.external && <ExternalLink className="w-3 h-3" />}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Backers Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 pt-12 border-t border-white/5"
        >
          <h4 className="text-center font-mono text-sm text-gray-500 uppercase tracking-wider mb-6">
            Backed by industry leaders
          </h4>
          <div className="flex flex-wrap justify-center gap-3">
            {backers.map((backer) => (
              <BackerLogo key={backer.name} name={backer.name} tier={backer.tier} />
            ))}
          </div>
        </motion.div>

        {/* Founding Team Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 pt-12 border-t border-white/5"
        >
          <h4 className="text-center font-mono text-sm text-gray-500 uppercase tracking-wider mb-8">
            Founding Team
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {foundingTeam.map((member) => (
              <motion.div
                key={member.name}
                whileHover={{ y: -4 }}
                className="p-4 bg-white/5 rounded-lg border border-white/5 hover:border-[var(--accent)]/30 transition-all cursor-pointer group"
              >
                <h5 className="font-mono font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                  {member.name}
                </h5>
                <p className="text-[var(--accent)] text-sm font-mono mt-1">{member.role}</p>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">{member.bio}</p>
                <div className="flex gap-2 mt-3">
                  {member.linkedin && (
                    <a
                      href={member.linkedin}
                      className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                      aria-label={`${member.name}'s LinkedIn`}
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {member.twitter && (
                    <a
                      href={member.twitter}
                      className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                      aria-label={`${member.name}'s Twitter`}
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {member.github && (
                    <a
                      href={member.github}
                      className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                      aria-label={`${member.name}'s GitHub`}
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm font-mono">
            © {new Date().getFullYear()} Sentrix Swarms. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#privacy" className="text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors cursor-pointer">
              Privacy Policy
            </Link>
            <Link href="#terms" className="text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors cursor-pointer">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

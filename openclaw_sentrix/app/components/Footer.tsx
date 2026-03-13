"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Github, Linkedin, Mail, ExternalLink } from "lucide-react";

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

const foundingTeam = [
  { 
    name: "Desmond Zee", 
    role: "Co-founder",
    bio: "Cambridge BEng. Previous Founder of LetsMove — computer vision for physiotherapy.",
    linkedin: "https://www.linkedin.com/in/desmond-zee",
    github: "https://github.com/desmondzee"
  },
  { 
    name: "Joe Wee Tan", 
    role: "Co-founder",
    bio: "UCL BSc CS. Onflow Founding Engineer — UX insights with browser use agents.",
    linkedin: "https://www.linkedin.com/in/tanweejoe",
    github: "https://github.com/w3joe"
  },
];

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
                href="https://www.linkedin.com/company/sentrixai"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://huggingface.co/akoniti"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="HuggingFace"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
              </a>
              <a
                href="mailto:dz386@cam.ac.uk"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
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
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                      aria-label={`${member.name}'s LinkedIn`}
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {member.github && (
                    <a
                      href={member.github}
                      target="_blank"
                      rel="noopener noreferrer"
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

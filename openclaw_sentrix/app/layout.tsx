import type { Metadata } from "next";
import { Silkscreen, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "./components/SmoothScroll";
import { AppNav } from "./components/AppNav";
import { GTCBanner } from "./components/GTCBanner";

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  variable: "--font-pixel",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sentrix — Agentic police for your AI",
  description:
    "Next-gen agentic guardrails. Patrol teams and investigators that police your agents and keep autonomous AI in check.",
  icons: {
    icon: "/sentrix_bw_logo.png",
    shortcut: "/sentrix_bw_logo.png",
    apple: "/sentrix_bw_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${silkscreen.variable} ${jetbrainsMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <SmoothScroll>
          <AppNav />
          <GTCBanner />
          <div className="pt-14">{children}</div>
        </SmoothScroll>
      </body>
    </html>
  );
}

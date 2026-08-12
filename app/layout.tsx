import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fonts are provided via CSS variables (--font-sans / --font-display / --font-mono)
// defined in globals.css using system-font stacks. This avoids next/font/google,
// which performs a blocking network fetch to fonts.googleapis.com / fonts.gstatic.com
// at build time and hangs the dev server / build when those hosts are unreachable.

export const metadata: Metadata = {
  title: "WebBrixs Lead Scraper",
  description: "WebBrixs Lead Scraper — Scrape → Audit → Rank → Build → Outreach",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}

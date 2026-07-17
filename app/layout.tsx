import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BYK RoadRescue',
  description: 'Roadside emergency and vehicle rescue operations platform',
};

/**
 * Root layout stays a Server Component (no hooks here) — the interactive
 * pieces (AppShell, SLAWidget, etc.) declare 'use client' themselves where
 * needed, starting at app/page.tsx. Fonts are loaded here via Google Fonts
 * for the demo; swap for next/font/google (self-hosted, no external request)
 * before shipping to production.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

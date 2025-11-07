// src/app/layout.tsx
// App shell for HPU Class of 2029 SGA — metadata, global CSS, sticky header, footer.
// Server component; includes a tiny client bootstrap to wire motion/ripple.

import type { Metadata, Viewport } from "next";
import React from "react";
import "@/app/tokens.css";
import "@/app/globals.css";
import { LiquidHeader } from "@/components/ui";

// ---- Next.js Metadata ----
export const metadata: Metadata = {
  title: "HPU 2029 SGA — Liquid Transparency, Real Impact",
  description:
    "Events that bring us together. Budgets you can explore. Class of 2029 SGA at High Point University.",
  icons: {
    icon: "/img/favicon.svg",
    shortcut: "/img/favicon.svg",
    apple: "/img/favicon.svg",
  },
  themeColor: "#330072",
  applicationName: "HPU 2029 SGA",
  openGraph: {
    title: "HPU 2029 SGA",
    description:
      "Liquid transparency, real impact — explore events, ledger, and bills.",
    type: "website",
    url: "https://example.com/",
    images: [{ url: "/img/hero.jpg", width: 1200, height: 630, alt: "HPU 2029 SGA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HPU 2029 SGA",
    description: "Events that bring us together. Budgets you can explore.",
    images: ["/img/hero.jpg"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#330072",
  width: "device-width",
  initialScale: 1,
};

// ---- Client bootstrap for global ripple/motion (safe no-op on reduce) ----
function MotionBootstrap() {
  // Mark client and wire effects lazily to avoid SSR warnings.
  // eslint-disable-next-line @next/next/no-head-element
  return <ClientBinder />;
}

function ClientBinder() {
  // Client-only mini component
  if (typeof window === "undefined") return null;
  // dynamic import to keep server clean
  import("@/lib/effects").then(({ Effects }) => {
    Effects.bindGlobalRipple();
  });
  return null;
}

// ---- Root Layout ----
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MotionBootstrap />
        <LiquidHeader />
        <main>{children}</main>
        <footer
          className="section"
          aria-label="Footer"
          style={{
            borderTop: "1px solid rgba(255,255,255,.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.00))",
          }}
        >
          <div className="container" style={{ display: "grid", gap: 8 }}>
            <div className="caption">Finance is student-first and explainable.</div>
            <div className="caption">
              © {new Date().getFullYear()} HPU Class of 2029 SGA. Crafted with care.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

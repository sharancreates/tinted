import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/layout/Navbar";
import { THEME_PRELOAD_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial serif for the one hero line per screen. Optical sizing keeps it
// from looking spindly at display sizes.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Tinted — Your Perfect Shade",
  description:
    "Find your foundation match and build a skincare routine, from a photo or a two-minute quiz.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

// suppressHydrationWarning is placed on <html> strictly for the data-theme attribute injected pre-hydration by THEME_PRELOAD_SCRIPT. React only suppresses attribute warnings on <html> itself.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text antialiased">
        <Script
          id="theme-preload"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: THEME_PRELOAD_SCRIPT,
          }}
        />
        {/* First thing in the tab order — keyboard users shouldn't have to
            traverse the nav on every page. */}
        <a href="#main" className="sr-only-focusable">
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}

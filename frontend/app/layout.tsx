import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/layout/AppShell";
import { WakeServer } from "@/components/layout/WakeServer";
import { THEME_PRELOAD_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Playfair Display for headings, DM Sans for everything else (MASTER.md).
// Both are variable fonts, so every weight comes from one file each.
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tinted: your perfect shade",
  description:
    "Find your foundation match and build a skincare routine, from a photo or a two-minute quiz.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  viewportFit: "cover",
};

// suppressHydrationWarning is placed on <html> strictly for the data-theme attribute injected pre-hydration by THEME_PRELOAD_SCRIPT. React only suppresses attribute warnings on <html> itself.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text antialiased">
        <Script
          id="theme-preload"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: THEME_PRELOAD_SCRIPT,
          }}
        />
        {/* First in the tab order, so keyboard users can skip the nav. */}
        <a href="#main" className="sr-only-focusable">
          Skip to content
        </a>
        <WakeServer />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

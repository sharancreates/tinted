import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { WakeServer } from "@/components/layout/WakeServer";
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
  themeColor: "#faf6f1",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="text-text antialiased">
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

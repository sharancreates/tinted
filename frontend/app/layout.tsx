import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { WakeServer } from "@/components/layout/WakeServer";
import "./globals.css";

// Poppins throughout (MASTER.md): its round geometric letters echo the orb.
// Not a variable font, so the four weights the system uses are listed.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tinted: your perfect shade",
  description:
    "Find your foundation match and build a skincare routine, from a photo or a two-minute quiz.",
};

export const viewport: Viewport = {
  themeColor: "#eeeceb",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
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

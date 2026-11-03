import type { Metadata } from "next";
import { Page } from "@/components/ui/Page";
import { HomeScreen } from "@/components/HomeScreen";

export const metadata: Metadata = {
  title: "Tinted: find the shade that matches you",
  description:
    "Foundation matching that works across the full range of skin tones. Read your depth and undertone from a photo, or take a two-minute skincare quiz.",
};

export default function HomePage() {
  return (
    <Page width="grid">
      <HomeScreen />
    </Page>
  );
}

import { MobileApp } from "@/components/mobile/MobileApp";

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal",
  description: "Predict, trade, settle onchain.",
};

// Standalone route for the mobile app — renders full-screen at any viewport.
// The MobileGate in layout.tsx handles auto-routing on narrow viewports.
export default function MobilePage() {
  return <MobileApp />;
}

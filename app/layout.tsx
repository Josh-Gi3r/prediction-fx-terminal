// layout.tsx is intentionally dynamic: it reads the per-request `x-nonce`
// header set by middleware.ts to stamp Script tags with a CSP nonce.
// This is correct — RSC layouts with headers() opt out of static generation.
import { MobileGate } from "@/components/MobileGate";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Manrope, Sora } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";
import "./design.css";

const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--f-display" });
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--f-body",
});
const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-tech",
});

// APP_NAME is read at build time via NEXT_PUBLIC_APP_NAME.
// Set it in .env.local or your deployment environment.
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal";
const APP_DESCRIPTION =
  "Prediction markets, emerging-market FX, and stablecoin yield in one self-custodial app, settled onchain.";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · predict, trade, settle onchain`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.example.com",
  ),
  openGraph: {
    type: "website",
    title: `${APP_NAME} · predict, trade, settle onchain`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the nonce injected by middleware.ts.
  // Falls back to undefined if absent (static export or middleware skipped).
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${sora.variable} ${manrope.variable} ${chakra.variable}`}
    >
      {/*
       * Telegram Mini App SDK — must load before the React tree so that
       * window.Telegram.WebApp is available on first render. Only runs inside
       * Telegram's in-app browser; harmless (no-op) in a regular browser.
       * The nonce prop is required for the CSP nonce policy to allow this script.
       */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
        nonce={nonce}
      />
      <body>
        <Providers>
          <MobileGate>{children}</MobileGate>
        </Providers>
      </body>
    </html>
  );
}

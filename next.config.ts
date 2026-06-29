import type { NextConfig } from "next";

/**
 * LEGACY ENFORCED CSP — kept until middleware.ts ENFORCE flag is flipped true.
 *
 * This is the static fallback policy applied by Next.js headers(). It uses
 * 'unsafe-inline' because it cannot issue per-request nonces. Once the
 * middleware report-only phase completes and ENFORCE is set to true, delete the
 * `{ key: "Content-Security-Policy", value: CSP }` line from headers() below
 * and let the middleware-issued per-request nonce policy take over entirely.
 *
 * Do NOT remove this block before flipping ENFORCE — during the report-only
 * phase this enforced policy is the only thing actually protecting users.
 */
const CSP = [
  "default-src 'self'",
  // Next.js inline runtime + styled-jsx need these two in practice.
  // telegram.org added for the Telegram Mini App SDK script.
  "script-src 'self' 'unsafe-inline' https://auth.privy.io https://telegram.org https://*.telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.your-fx-provider.example.com https://*.privy.io wss://*.privy.io https://rpc.privy.systems https://*.rpc.privy.systems https://ethereum-rpc.publicnode.com https://ethereum-sepolia-rpc.publicnode.com https://base-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://arbitrum-one-rpc.publicnode.com https://api.zkp2p.xyz https://api.hyperliquid.xyz https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://telegram.org https://*.telegram.org",
  // frame-src: Privy auth iframe + WalletConnect + Telegram OAuth widget
  "frame-src https://auth.privy.io https://verify.walletconnect.com https://oauth.telegram.org",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
  // Hardened extras added 2026-06-12.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "@visx/group", "@visx/scale", "@visx/shape"],
  },
  // MetaMask SDK + WalletConnect optionally import React-Native-only modules that
  // don't exist in a browser build. Webpack normally warns, but depending on
  // build-cache state it can flip to a FATAL error and fail the deploy
  // nondeterministically (a clean GitHub build can fail while a warm `railway up`
  // of the same code succeeds). Resolve them to false so the build is deterministic.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "@stripe/crypto": false,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 6 months, no preload until the apex domain strategy is settled.
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), usb=(), payment=()",
          },
          // LEGACY ENFORCED CSP — remove this line when middleware ENFORCE=true.
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;

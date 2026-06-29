import { type NextRequest, NextResponse } from "next/server";

/**
 * CSP ENFORCEMENT SWITCH
 * ─────────────────────────────────────────────────────────────────────────────
 * ENFORCE = false  →  sets Content-Security-Policy-Report-Only (safe staging)
 * ENFORCE = true   →  sets Content-Security-Policy (live enforcement)
 *
 * Flip procedure:
 *   1. Confirm zero violations in browser console / report endpoint.
 *   2. Set ENFORCE = true here.
 *   3. Remove the `{ key: "Content-Security-Policy", value: CSP }` entry from
 *      next.config.ts headers() — the middleware header wins per-request and
 *      the static header becomes redundant noise.
 *   4. Deploy. Done.
 */
const ENFORCE = false;

/**
 * Build the per-request CSP string.
 *
 * Strategy:
 *   script-src uses 'nonce-<n>' + 'strict-dynamic' as the primary trust anchor.
 *   The explicit host allowlist is kept as a FALLBACK for browsers that don't
 *   honour strict-dynamic (Safari < 15.4, some older WebViews). Either path
 *   allows the same scripts; the nonce path is strictly safer.
 *
 * All other directives are copied verbatim from next.config.ts so the two
 * policies stay in sync until ENFORCE is flipped.
 */
function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",

    // script-src: nonce + strict-dynamic (primary) + explicit hosts (fallback).
    // 'unsafe-inline' is intentionally OMITTED here — strict-dynamic makes it
    // a no-op in compliant browsers, and we want the report-only phase to surface
    // any inline scripts that need a nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://auth.privy.io https://telegram.org https://*.telegram.org`,

    // Tailwind and CSS-in-JS require unsafe-inline; no nonce path for styles yet.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",

    // connect-src: all upstream API / RPC / WS / WalletConnect hosts.
    [
      "connect-src 'self'",
      "https://api.your-fx-provider.example.com",
      "https://*.privy.io",
      "wss://*.privy.io",
      "https://rpc.privy.systems",
      "https://*.rpc.privy.systems",
      "https://ethereum-rpc.publicnode.com",
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://base-rpc.publicnode.com",
      "https://polygon-bor-rpc.publicnode.com",
      "https://arbitrum-one-rpc.publicnode.com",
      "https://api.zkp2p.xyz",
      "https://api.hyperliquid.xyz",
      "https://*.walletconnect.com",
      "wss://*.walletconnect.com",
      "https://*.walletconnect.org",
      "wss://*.walletconnect.org",
      "https://telegram.org",
      "https://*.telegram.org",
    ].join(" "),

    // frame-src: Privy auth iframe + WalletConnect + Telegram OAuth widget
    "frame-src https://auth.privy.io https://verify.walletconnect.com https://oauth.telegram.org",
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",

    // Hardened extras (were absent from the legacy policy).
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(request: NextRequest): NextResponse {
  // Generate a cryptographically random nonce, base64-encoded.
  // crypto.randomUUID() is available in the Edge runtime.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCSP(nonce);

  // Forward the nonce to the RSC layer so layout.tsx can stamp <Script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set the policy header — report-only until ENFORCE is flipped.
  const headerName = ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

  response.headers.set(headerName, csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     *   - _next/static  (pre-built assets, no script execution context)
     *   - _next/image   (image optimisation responses)
     *   - favicon.ico
     *   - /api/*        (JSON responses don't execute scripts; skip overhead)
     *
     * The negative-lookahead regex is the Next.js-recommended pattern.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};

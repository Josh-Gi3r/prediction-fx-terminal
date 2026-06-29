"use client";

/**
 * lib/polymarket/order.ts
 *
 * Client-side order construction helpers.
 *
 * Security model:
 * - makeUserClobClient() builds a ClobClient that signs orders with the
 *   user's wallet directly in the browser. Creds never leave the browser.
 * - Builder attribution happens via the remote-sign route: the SDK posts
 *   {method, path, body, timestamp} to /api/pm/builder-sign, which adds
 *   POLY_BUILDER_* headers using the server-stored secret. The client never
 *   sees the builder secret.
 * - secureSalt() generates a cryptographically random salt that is safe to
 *   pass through Number.parseInt (i.e., <= Number.MAX_SAFE_INTEGER = 2^53-1).
 *
 * Re-exported constants (PROTOCOL_NAME, PROTOCOL_VERSION, getContractConfig)
 * are used in tests to build the correct EIP-712 domain for signature recovery.
 *
 * NOTE on BuilderConfig: @polymarket/builder-signing-sdk bundles node:crypto
 * (HMAC signing) even in the BuilderConfig class (via a static import of
 * BuilderSigner). This cannot be included in the browser bundle. Instead,
 * makeUserClobClient() creates a duck-typed proxy object that matches the two
 * methods ClobClient calls on builderConfig:
 *   - isValid(): always true (remote URL is fixed)
 *   - generateBuilderHeaders(method, path, body): POSTs to /api/pm/builder-sign
 *     and returns the POLY_BUILDER_* headers
 * This avoids importing the SDK's BuilderConfig class in client code.
 */

import { Chain, ClobClient, SignatureType } from "@polymarket/clob-client";
import type { TickSize } from "@polymarket/clob-client";
import type { WalletClient } from "viem";
import type { PmCreds } from "./useDeriveCreds";

// ─── re-exported helpers ─────────────────────────────────────────────────────

/**
 * Convert a USDC dollar amount to raw 6-decimal integer (as bigint).
 * Re-exported here so UI components have a single import point.
 * Round up to ensure approval covers the full cost.
 */
export function usdcToRaw(usdcAmount: number): bigint {
  return BigInt(Math.ceil(usdcAmount * 10 ** 6));
}

// ─── public constants ────────────────────────────────────────────────────────

export const CLOB_HOST = "https://clob.polymarket.com";
export const PROTOCOL_NAME = "Polymarket CTF Exchange";
export const PROTOCOL_VERSION = "1";

/** Returns the Polygon contract addresses for chain 137. */
export function getContractConfig(chainId: 137): {
  exchange: `0x${string}`;
  negRiskExchange: `0x${string}`;
  collateral: `0x${string}`;
} {
  return {
    exchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
    negRiskExchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
    collateral: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  };
}

// ─── salt ────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random salt that survives Number.parseInt
 * round-trip without precision loss (i.e., the integer <= 2^53-1).
 *
 * The SDK's orderToJson calls Number.parseInt(order.salt, 10) before
 * sending to the wire, so salts > 2^53-1 would silently corrupt.
 *
 * Note: secureSalt is not called on the production bet path (the SDK
 * generates its own salt internally via createOrder). It is exported for
 * any caller that needs a safe random integer in the JS safe-integer range.
 */
export function secureSalt(): string {
  const MAX_SAFE = 9_007_199_254_740_991n; // 2^53-1
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  // Combine two 32-bit values into a 53-bit-safe number:
  // upper 21 bits from buf[0] + lower 32 bits from buf[1]
  const hi = buf[0] ?? 0;
  const lo = buf[1] ?? 0;
  const upper = BigInt(hi & 0x1fffff); // 21 bits
  const lower = BigInt(lo); // 32 bits
  const value = (upper << 32n) | lower;
  // Clamp to MAX_SAFE. Use (MAX_SAFE - 1) as the modulo base so that
  // value % (MAX_SAFE - 1) is in [0, MAX_SAFE-2], then add 1 to guarantee
  // non-zero. This avoids the edge case where value===MAX_SAFE would return 0
  // under `value % MAX_SAFE`.
  const safe = value >= MAX_SAFE ? ((value - 1n) % (MAX_SAFE - 1n)) + 1n : value || 1n;
  return safe.toString();
}

// ─── browser-safe builder config proxy ──────────────────────────────────────

/**
 * Create a duck-typed proxy for ClobClient's builderConfig parameter that
 * works in the browser without importing @polymarket/builder-signing-sdk
 * (which pulls in node:crypto).
 *
 * ClobClient only calls two methods on builderConfig:
 *   - isValid(): returns true if builder is configured
 *   - generateBuilderHeaders(method, path, body): returns POLY_BUILDER_* headers
 *
 * This proxy calls /api/pm/builder-sign (our server-side signing route) to
 * obtain the headers. The builder HMAC secret is never sent to the browser.
 */
function makeRemoteBuilderProxy(remoteUrl: string) {
  return {
    isValid(): boolean {
      return true;
    },
    async generateBuilderHeaders(
      method: string,
      path: string,
      body?: string,
    ): Promise<Record<string, string> | undefined> {
      try {
        const res = await fetch(remoteUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method, path, body }),
        });
        if (!res.ok) return undefined;
        return (await res.json()) as Record<string, string>;
      } catch {
        console.warn("[builderProxy] remote sign failed");
        return undefined;
      }
    },
  };
}

// ─── client factory ──────────────────────────────────────────────────────────

/**
 * Build a ClobClient for the user's wallet.
 *
 * @param walletClient  Viem WalletClient on Polygon (chain 137).
 * @param creds         User's L2 CLOB credentials derived client-side.
 * @param origin        App origin for the builder-sign proxy route URL
 *                      (e.g., "https://your-app.example.com" or "http://localhost:3000").
 *
 * Builder attribution: the remote builder proxy POSTs {method, path, body} to
 * ${origin}/api/pm/builder-sign, receives signed POLY_BUILDER_* headers, and
 * returns them so ClobClient can attach them to every order. The builder HMAC
 * secret never reaches the browser.
 */
export function makeUserClobClient(
  walletClient: WalletClient,
  creds: PmCreds,
  origin: string,
): ClobClient {
  const apiKeyCreds = {
    key: creds.key,
    secret: creds.secret,
    passphrase: creds.passphrase,
  };

  const builderProxy = makeRemoteBuilderProxy(`${origin}/api/pm/builder-sign`);

  return new ClobClient(
    CLOB_HOST,
    Chain.POLYGON,
    // biome-ignore lint/suspicious/noExplicitAny: viem WalletClient satisfies ClobSigner per SDK types
    walletClient as any,
    apiKeyCreds,
    SignatureType.EOA,
    undefined, // funderAddress
    undefined, // geoBlockToken
    undefined, // useServerTime
    // biome-ignore lint/suspicious/noExplicitAny: duck-typed proxy matches ClobClient's builderConfig interface
    builderProxy as any,
  );
}

// ─── order args ──────────────────────────────────────────────────────────────

export interface BetOrderArgs {
  tokenID: string;
  price: number;
  side: "BUY" | "SELL";
  size: number;
}

export interface BetOrderOptions {
  /** Must be one of the SDK's TickSize literals: "0.1" | "0.01" | "0.001" | "0.0001" */
  tickSize: string;
  negRisk: boolean;
}

/**
 * Build and sign an order using the SDK's createOrder method.
 *
 * Uses Side.BUY from the SDK; expiration defaults to "0" (SDK convention for
 * no expiration -- the order type passed to postOrder controls FOK/GTC, not
 * this field).
 *
 * Note: We pass options.tickSize as TickSize (a literal union "0.1"|"0.01"|
 * "0.001"|"0.0001"). The registry always returns one of these values.
 */
export async function buildBet(client: ClobClient, args: BetOrderArgs, options: BetOrderOptions) {
  const { Side } = await import("@polymarket/clob-client");
  const side = args.side === "BUY" ? Side.BUY : Side.SELL;

  return client.createOrder(
    {
      tokenID: args.tokenID,
      price: args.price,
      size: args.size,
      side,
      feeRateBps: 0,
      // expiration "0" = SDK no-expiration convention
    },
    {
      tickSize: options.tickSize as TickSize,
      negRisk: options.negRisk,
    },
  );
}

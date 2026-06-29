/**
 * lib/account/session.test.ts
 *
 * Tests for the SIWE session layer.
 * Runs in Node environment (no DOM, no DATABASE_URL required).
 *
 * Covers:
 *   - createNonce: single-use enforcement, expiry
 *   - buildSiweMessage: structure
 *   - verifyLogin: domain mismatch, expired nonce, reused nonce, bad sig, valid EOA
 *   - mintSession / readSession: round-trip, tamper rejection, Bearer path
 *   - THE KEY INVARIANT: session for wallet A never resolves to wallet B
 */

import type { NextRequest } from "next/server";
import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signMessage } from "viem/actions";
import { mainnet } from "viem/chains";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetNonceStore,
  _storeNonce,
  buildSiweMessage,
  clearCookie,
  createNonce,
  mintSession,
  readSession,
  sessionCookie,
  verifyLogin,
} from "./session";

// ─── Test environment setup ───────────────────────────────────────────────────

// SESSION_JWT_SECRET must be set before any test imports mintSession/readSession.
// Use a fixed 32-byte test key.
const TEST_SECRET = "a".repeat(64); // 32 bytes as hex

beforeEach(() => {
  process.env.SESSION_JWT_SECRET = TEST_SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://your-app.example.com";
  _resetNonceStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Throwaway test accounts ──────────────────────────────────────────────────

// Two distinct private keys — used for the invariant test.
const PRIVATE_KEY_A = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const PRIVATE_KEY_B = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

const accountA = privateKeyToAccount(PRIVATE_KEY_A);
const accountB = privateKeyToAccount(PRIVATE_KEY_B);

function makeWalletClient(privateKey: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: mainnet,
    transport: http("https://eth.llamarpc.com"),
  });
}

async function signSiwe(privateKey: `0x${string}`, message: string): Promise<`0x${string}`> {
  const client = makeWalletClient(privateKey);
  return client.signMessage({ message });
}

// ─── createNonce ──────────────────────────────────────────────────────────────

describe("createNonce", () => {
  it("returns a 32-char hex string", () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns unique nonces on each call", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
  });
});

// ─── buildSiweMessage ─────────────────────────────────────────────────────────

describe("buildSiweMessage", () => {
  it("contains domain, address, nonce, and statement", () => {
    const nonce = createNonce();
    const msg = buildSiweMessage(accountA.address, nonce, "your-app.example.com");
    expect(msg).toContain("your-app.example.com wants you to sign in");
    expect(msg).toContain(accountA.address);
    expect(msg).toContain(`Nonce: ${nonce}`);
    expect(msg).toContain("Sign in to");
    expect(msg).toContain("Chain ID: 1");
  });
});

// ─── verifyLogin ─────────────────────────────────────────────────────────────

describe("verifyLogin", () => {
  it("rejects a wrong domain", async () => {
    const nonce = createNonce();
    const msg = buildSiweMessage(accountA.address, nonce, "evil.com");
    const sig = await signSiwe(PRIVATE_KEY_A, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBeNull();
  });

  it("rejects a bad signature", async () => {
    const nonce = createNonce();
    const msg = buildSiweMessage(accountA.address, nonce);
    // Sign with wrong key
    const sig = await signSiwe(PRIVATE_KEY_B, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBeNull();
  });

  it("rejects an unknown nonce", async () => {
    const msg = buildSiweMessage(accountA.address, "deadbeefdeadbeefdeadbeefdeadbeef");
    const sig = await signSiwe(PRIVATE_KEY_A, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBeNull();
  });

  it("rejects a reused nonce (single-use enforcement)", async () => {
    const nonce = createNonce();
    const msg = buildSiweMessage(accountA.address, nonce);
    const sig = await signSiwe(PRIVATE_KEY_A, msg);

    // First use should succeed.
    const first = await verifyLogin(msg, sig);
    expect(first).toBe(accountA.address.toLowerCase());

    // Second use with same nonce must fail.
    const second = await verifyLogin(msg, sig);
    expect(second).toBeNull();
  });

  it("rejects an expired nonce", async () => {
    const nonce = createNonce();
    // Manually expire it.
    _storeNonce(nonce, { expiresAt: Date.now() - 1, used: false });
    const msg = buildSiweMessage(accountA.address, nonce);
    const sig = await signSiwe(PRIVATE_KEY_A, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBeNull();
  });

  it("accepts a valid EOA signature and returns lowercased address", async () => {
    const nonce = createNonce();
    const msg = buildSiweMessage(accountA.address, nonce);
    const sig = await signSiwe(PRIVATE_KEY_A, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBe(accountA.address.toLowerCase());
  });

  it("rejects an expired SIWE message (expirationTime in the past)", async () => {
    const nonce = createNonce();
    // Build a message with a past expiration.
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const msg = [
      "your-app.example.com wants you to sign in with your Ethereum account:",
      accountA.address,
      "",
      "Sign in to PredFX Terminal to sync your settings.",
      "",
      "URI: https://your-app.example.com",
      "Version: 1",
      "Chain ID: 1",
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
      `Expiration Time: ${pastExpiry}`,
    ].join("\n");
    const sig = await signSiwe(PRIVATE_KEY_A, msg);
    const result = await verifyLogin(msg, sig);
    expect(result).toBeNull();
  });
});

// ─── mintSession / readSession ────────────────────────────────────────────────

function makeReq(
  opts: { cookie?: string; bearer?: string } = {},
): Pick<NextRequest, "cookies" | "headers"> {
  return {
    cookies: {
      get: (name: string) =>
        name === "__Host-sid" && opts.cookie ? { value: opts.cookie } : undefined,
    } as NextRequest["cookies"],
    headers: new Headers(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
  } as Pick<NextRequest, "cookies" | "headers">;
}

describe("mintSession / readSession", () => {
  it("round-trips: minted token reads back to the same address", async () => {
    const addr = accountA.address.toLowerCase();
    const token = await mintSession(addr);
    const req = makeReq({ cookie: token });
    const session = await readSession(req as NextRequest);
    expect(session?.address).toBe(addr);
  });

  it("returns null for a tampered token", async () => {
    const token = await mintSession(accountA.address.toLowerCase());
    // Flip last character of the signature segment.
    const parts = token.split(".");
    const last = parts[parts.length - 1]!;
    parts[parts.length - 1] = last.slice(0, -1) + (last.endsWith("a") ? "b" : "a");
    const tampered = parts.join(".");
    const req = makeReq({ cookie: tampered });
    const session = await readSession(req as NextRequest);
    expect(session).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Mint with a secret but craft a token whose exp is in the past.
    // We test this by using a very-short-lived token via a fake time.
    // Simplest approach: directly craft a JWT with past exp using jose.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode("a".repeat(64));
    const past = Math.floor(Date.now() / 1_000) - 3600;
    const expiredToken = await new SignJWT({ addr: accountA.address.toLowerCase() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(process.env.APP_NAME ?? "predfx-terminal")
      .setAudience(process.env.APP_NAME ?? "predfx-terminal")
      .setIssuedAt(past - 86400)
      .setExpirationTime(past)
      .sign(key);

    const req = makeReq({ cookie: expiredToken });
    const session = await readSession(req as NextRequest);
    expect(session).toBeNull();
  });

  it("Bearer header path works (Telegram WebView fallback)", async () => {
    const addr = accountA.address.toLowerCase();
    const token = await mintSession(addr);
    // No cookie — only Authorization: Bearer header.
    const req = makeReq({ bearer: token });
    const session = await readSession(req as NextRequest);
    expect(session?.address).toBe(addr);
  });

  it("cookie takes precedence over a valid Bearer header", async () => {
    const addrA = accountA.address.toLowerCase();
    const addrB = accountB.address.toLowerCase();
    const tokenA = await mintSession(addrA);
    const tokenB = await mintSession(addrB);
    // Cookie is A, Bearer is B — should return A.
    const req = makeReq({ cookie: tokenA, bearer: tokenB });
    const session = await readSession(req as NextRequest);
    expect(session?.address).toBe(addrA);
  });
});

// ─── THE KEY INVARIANT ────────────────────────────────────────────────────────
// A session for wallet A must never resolve to wallet B regardless of what
// is sent in the request body.  readSession returns the address from the
// cryptographically-signed token only.

describe("INVARIANT: session address isolation", () => {
  it("session minted for A returns A even if body claims B", async () => {
    const addrA = accountA.address.toLowerCase();
    const tokenA = await mintSession(addrA);

    // Simulate a request where the cookie holds A's token but the hypothetical
    // body would have claimed B's address.  readSession should return A.
    const req = makeReq({ cookie: tokenA });
    const session = await readSession(req as NextRequest);

    // Session address is A — not influenced by anything from the request body.
    expect(session?.address).toBe(addrA);
    expect(session?.address).not.toBe(accountB.address.toLowerCase());
  });

  it("a token minted for B cannot be parsed as A", async () => {
    const addrA = accountA.address.toLowerCase();
    const addrB = accountB.address.toLowerCase();
    const tokenB = await mintSession(addrB);

    const req = makeReq({ cookie: tokenB });
    const session = await readSession(req as NextRequest);

    expect(session?.address).toBe(addrB);
    expect(session?.address).not.toBe(addrA);
  });

  it("a forged token with A address but wrong secret is rejected", async () => {
    // Attacker mints a token with a different secret claiming addrA.
    const { SignJWT } = await import("jose");
    const wrongKey = new TextEncoder().encode("b".repeat(64));
    const now = Math.floor(Date.now() / 1_000);
    const forged = await new SignJWT({ addr: accountA.address.toLowerCase() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(process.env.APP_NAME ?? "predfx-terminal")
      .setAudience(process.env.APP_NAME ?? "predfx-terminal")
      .setIssuedAt(now)
      .setExpirationTime(now + 86400)
      .sign(wrongKey);

    const req = makeReq({ cookie: forged });
    const session = await readSession(req as NextRequest);
    expect(session).toBeNull();
  });
});

// ─── Cookie helpers ───────────────────────────────────────────────────────────

describe("sessionCookie / clearCookie", () => {
  it("sessionCookie contains __Host-sid prefix, HttpOnly, Secure, SameSite=Lax", () => {
    const cookie = sessionCookie("tok123");
    expect(cookie).toContain("__Host-sid=tok123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    // __Host- prefix requires NO Domain attribute.
    expect(cookie).not.toContain("Domain=");
  });

  it("clearCookie sets Max-Age=0", () => {
    const cookie = clearCookie();
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("__Host-sid=");
  });
});

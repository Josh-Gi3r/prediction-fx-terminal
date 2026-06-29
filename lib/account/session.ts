/**
 * lib/account/session.ts
 *
 * Wallet-signed session layer (SIWE → HMAC cookie).
 *
 * INVARIANT: the address for any DB authz comes ONLY from readSession().
 * NEVER trust an address from a request body or query string.
 * Routes that call readSession must use session.address exclusively;
 * they must never substitute req.body.address or req.nextUrl.searchParams
 * for authorization decisions.
 *
 * Session flow:
 *   1. Client GET /api/account/nonce  → { nonce }
 *   2. Client signs a SIWE message with the nonce
 *   3. Client POST /api/account/login { message, signature }
 *   4. Server verifies SIWE (domain, nonce single-use, expiry, EIP-1271)
 *   5. Server mints a JWT (jose HS256) and sets __Host-sid cookie
 *      AND returns token in body for Telegram WebView (Bearer fallback)
 *   6. readSession() reads __Host-sid cookie OR Authorization: Bearer header
 *
 * EIP-1271 note: verifyLogin first tries viem's verifyMessage (off-chain
 * ecrecover).  If that resolves to a different address or fails, it falls
 * back to viem's publicClient.verifyMessage which performs the EIP-1271
 * on-chain call and validates Privy smart-wallet signatures.
 */

import "server-only";
import {
  SIWE_NONCE_TTL_MS as NONCE_TTL_MS,
  buildSiweMessage,
  getSiteDomain,
} from "@/lib/account/siwe";

export { buildSiweMessage } from "@/lib/account/siwe";

import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { http, createPublicClient, getAddress } from "viem";
import { mainnet } from "viem/chains";

// ─── Constants ────────────────────────────────────────────────────────────────

const COOKIE_NAME = "__Host-sid";
const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 h

// JWT issuer/audience is derived from APP_NAME env for portability.
const _APP_NAME = process.env.APP_NAME ?? "predfx-terminal";
const JWT_ISSUER = _APP_NAME;
const JWT_AUDIENCE = _APP_NAME;

// ─── Lazy secret ─────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const hex = process.env.SESSION_JWT_SECRET;
  if (!hex) throw new Error("[session] SESSION_JWT_SECRET is not set");
  // Accept raw hex or a plain string; hex is canonical per spec.
  if (/^[0-9a-fA-F]{32,}$/.test(hex)) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return new TextEncoder().encode(hex);
}

// ─── Nonce store ─────────────────────────────────────────────────────────────

interface NonceEntry {
  expiresAt: number;
  used: boolean;
}

const nonceStore = new Map<string, NonceEntry>();

/** Sweep expired nonces to prevent unbounded memory growth. */
function sweepNonces(): void {
  const now = Date.now();
  for (const [nonce, entry] of nonceStore.entries()) {
    if (now > entry.expiresAt) nonceStore.delete(nonce);
  }
}

let lastSweep = 0;
function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    sweepNonces();
    lastSweep = now;
  }
}

/**
 * Create a server-issued single-use nonce.
 * Stored in memory with a 5-minute TTL.
 */
export function createNonce(): string {
  maybeSweep();
  // 16 random bytes as lowercase hex = 32 chars.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  nonceStore.set(nonce, { expiresAt: Date.now() + NONCE_TTL_MS, used: false });
  return nonce;
}

// ─── SIWE message builder ─────────────────────────────────────────────────────

// ─── SIWE parser ─────────────────────────────────────────────────────────────

interface SiweFields {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: Date;
  expirationTime: Date | null;
}

function parseSiweMessage(message: string): SiweFields | null {
  try {
    const lines = message.split("\n");
    // Line 0: "<domain> wants you to sign in with your Ethereum account:"
    const domainMatch = lines[0]?.match(/^(.+) wants you to sign in/);
    if (!domainMatch) return null;
    const domain = domainMatch[1]!;

    // Line 1: address
    const address = lines[1]?.trim() ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

    const get = (key: string): string | undefined => {
      const prefix = `${key}: `;
      const line = lines.find((l) => l.startsWith(prefix));
      return line?.slice(prefix.length).trim();
    };

    const nonce = get("Nonce");
    if (!nonce) return null;

    const issuedAtStr = get("Issued At");
    if (!issuedAtStr) return null;
    const issuedAt = new Date(issuedAtStr);
    if (Number.isNaN(issuedAt.getTime())) return null;

    const expStr = get("Expiration Time");
    const expirationTime = expStr ? new Date(expStr) : null;

    return { domain, address, nonce, issuedAt, expirationTime };
  } catch {
    return null;
  }
}

// ─── EIP-1271 public client ───────────────────────────────────────────────────

let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function publicClient(): ReturnType<typeof createPublicClient> {
  if (_publicClient) return _publicClient;
  const rpc = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";
  _publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  return _publicClient;
}

// ─── verifyLogin ─────────────────────────────────────────────────────────────

/**
 * Verify a SIWE login attempt.
 *
 * Checks (in order):
 *   1. Message parses as valid SIWE.
 *   2. Domain matches this site.
 *   3. Nonce exists in store, is not used, is not expired.
 *   4. Message expiration not passed.
 *   5. Signature valid (EOA ecrecover first; EIP-1271 on-chain fallback).
 *
 * On success: marks nonce as used, returns lowercased verified address.
 * On any failure: returns null (no reason leaked to caller).
 */
export async function verifyLogin(message: string, signature: string): Promise<string | null> {
  try {
    const fields = parseSiweMessage(message);
    if (!fields) return null;

    // 1. Domain check.
    const expectedDomain = getSiteDomain();
    if (fields.domain !== expectedDomain) {
      console.warn(
        `[session] SIWE domain mismatch: got=${fields.domain} expected=${expectedDomain}`,
      );
      return null;
    }

    // 2. Nonce: exists, not used, not expired.
    const now = Date.now();
    const entry = nonceStore.get(fields.nonce);
    if (!entry) return null;
    if (entry.used) return null;
    if (now > entry.expiresAt) return null;

    // 3. Message expiration.
    if (fields.expirationTime && now > fields.expirationTime.getTime()) return null;

    // 4. Signature verification.
    const sig = signature as `0x${string}`;
    const claimedAddr = getAddress(fields.address).toLowerCase();

    let verified = false;

    // Path A: off-chain ecrecover (fast, no RPC call, works for EOA).
    try {
      const { verifyMessage } = await import("viem");
      const ok = await verifyMessage({
        address: getAddress(fields.address),
        message,
        signature: sig,
      });
      if (ok) {
        verified = true;
      }
    } catch {
      // fall through to EIP-1271
    }

    // Path B: EIP-1271 on-chain verify (handles Privy smart wallets, Safe, etc.).
    if (!verified) {
      try {
        const ok = await publicClient().verifyMessage({
          address: getAddress(fields.address),
          message,
          signature: sig,
        });
        if (ok) {
          verified = true;
        }
      } catch {
        return null;
      }
    }

    if (!verified) return null;

    // CONSUME nonce — single-use enforced.
    entry.used = true;

    return claimedAddr;
  } catch {
    return null;
  }
}

// ─── Session token (JWT HS256 via jose) ───────────────────────────────────────

export interface SessionPayload {
  address: string;
}

/**
 * Mint a 24-hour signed JWT for the given (lowercased) address.
 */
export async function mintSession(address: string): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({ addr: address.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_MS / 1_000)
    .sign(secret);
}

/**
 * Verify a session token and return the session payload.
 * Returns null on any error (expired, tampered, wrong iss/aud).
 */
async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    const addr = payload.addr;
    if (typeof addr !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
    return { address: addr };
  } catch {
    return null;
  }
}

/**
 * Read and verify the session from an incoming request.
 *
 * Checks (in priority order):
 *   1. `__Host-sid` cookie — standard browser path.
 *   2. `Authorization: Bearer <token>` header — Telegram WebView fallback
 *      (TG WebView drops cookies in some configurations).
 *
 * Returns { address } (lowercased) on success, null otherwise.
 */
export async function readSession(req: NextRequest): Promise<SessionPayload | null> {
  // 1. Cookie path.
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifyToken(cookieToken);
    if (session) return session;
  }

  // 2. Bearer header fallback (Telegram WebView).
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const bearerToken = auth.slice(7).trim();
    if (bearerToken) {
      const session = await verifyToken(bearerToken);
      if (session) return session;
    }
  }

  return null;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_OPTS = [
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  "Path=/",
  // No Domain attribute — required for __Host- prefix to be valid.
].join("; ");

/**
 * Returns a Set-Cookie header value for the session token.
 * Uses __Host- prefix: HttpOnly, Secure, SameSite=Lax, Path=/, no Domain.
 */
export function sessionCookie(token: string): string {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1_000);
  return `${COOKIE_NAME}=${token}; Max-Age=${maxAgeSec}; ${COOKIE_OPTS}`;
}

/**
 * Returns a Set-Cookie header value that clears the session cookie.
 */
export function clearCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; ${COOKIE_OPTS}`;
}

// ─── Test helpers (exported only in test env) ─────────────────────────────────
// Exposed via a named re-export so session.test.ts can reset nonce state.

export function _resetNonceStore(): void {
  nonceStore.clear();
  lastSweep = 0;
}

export function _storeNonce(nonce: string, entry: NonceEntry): void {
  nonceStore.set(nonce, entry);
}

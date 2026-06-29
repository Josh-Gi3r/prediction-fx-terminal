/**
 * Shared SIWE message construction — usable on BOTH client and server.
 *
 * No secrets, no DB, no node:crypto here, so the client (useAccountSync) can
 * build the exact message the server verifies. The verify/mint/session logic
 * that touches SESSION_JWT_SECRET + the DB stays in session.ts ("server-only").
 */
import { getAddress } from "viem";

export const SIWE_NONCE_TTL_MS = 5 * 60 * 1_000; // 5 min

export function getSiteDomain(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      return new URL(raw).host;
    } catch {
      // fall through
    }
  }
  // Fallback when NEXT_PUBLIC_SITE_URL is not set.
  // Set this env var to your deployed domain in production.
  return "your-app.example.com";
}

// App name for the SIWE sign-in statement (shown in wallet prompts).
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal";

/**
 * Build a SIWE-format message string. Callers pass domain/address/nonce;
 * issuedAt + expirationTime are set to now / now+TTL.
 */
export function buildSiweMessage(
  address: string,
  nonce: string,
  domain: string = getSiteDomain(),
): string {
  const checksumAddr = getAddress(address);
  const issuedAt = new Date();
  const expirationTime = new Date(issuedAt.getTime() + SIWE_NONCE_TTL_MS);

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    checksumAddr,
    "",
    `Sign in to ${APP_NAME} to sync your settings.`,
    "",
    `URI: https://${domain}`,
    "Version: 1",
    "Chain ID: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expirationTime.toISOString()}`,
  ].join("\n");
}

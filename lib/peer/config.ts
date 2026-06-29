/**
 * ─── Peer (zkP2P) shared config ──────────────────────────────────────────────
 *
 * Constants + types for the fiat ⇄ crypto ramp (peer.xyz / zkP2P protocol).
 * SAFE for client import — no secrets, no server-only deps.
 *
 * Peer settles on **Base mainnet (8453)** in USDC. There is NO testnet:
 * production / staging are both chain 8453 (staging only swaps the API host).
 * This build points at PRODUCTION by default and bridges
 * onramped USDC to **Ethereum mainnet (1)** for FX trading.
 *
 * Decimals (do NOT mix): USDC = 6, conversion rates = 18.
 */

import { USDC_BASE as _USDC_BASE, USDC_ETHEREUM as _USDC_ETHEREUM } from "@/lib/chains/tokens";

// ─── Chain + token ────────────────────────────────────────────────────────────

export const PEER_CHAIN_ID = 8453; // Base mainnet — where Peer escrow lives
export const USDC_BASE = _USDC_BASE;

/** Where onramped funds LAND: Ethereum mainnet USDC (Peer bridges for us). */
export const DEST_CHAIN_ID = 1;
export const USDC_ETHEREUM = _USDC_ETHEREUM;

/** `toToken` format = `chainId:tokenAddress`. */
export function toToken(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress}`;
}
export const DEST_TOTOKEN = toToken(DEST_CHAIN_ID, USDC_ETHEREUM);

// ─── Runtime env + service roots ──────────────────────────────────────────────

export type PeerRuntimeEnv = "production" | "staging";

export const PEER_SERVICE_ROOTS: Record<PeerRuntimeEnv, { baseApiUrl: string }> = {
  production: { baseApiUrl: "https://api.zkp2p.xyz" },
  staging: { baseApiUrl: "https://api-staging.zkp2p.xyz" },
};

/** PRODUCTION by default. Env-overridable for a staging run. */
export const PEER_ENV: PeerRuntimeEnv =
  process.env.NEXT_PUBLIC_PEER_ENV === "staging" ? "staging" : "production";

export const PEER_BASE_API_URL = PEER_SERVICE_ROOTS[PEER_ENV].baseApiUrl;

/**
 * Feature flag. OFF by default — flipping it on shows the /cash surface;
 * money still only moves via user-signed transactions.
 */
export const PEER_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PEER === "true";

/** App referrer fee (optional revenue hook). Set NEXT_PUBLIC_PEER_REFERRER_ADDRESS + _FEE_BPS in env. Unset = no fee taken. */
export function referrerFeeConfig(): { recipient: `0x${string}`; feeBps: number } | null {
  const r = process.env.NEXT_PUBLIC_PEER_REFERRER_ADDRESS ?? "";
  const bps = Number(process.env.NEXT_PUBLIC_PEER_REFERRER_FEE_BPS ?? "0");
  if (/^0x[a-fA-F0-9]{40}$/.test(r) && Number.isInteger(bps) && bps > 0 && bps <= 500) {
    return { recipient: r as `0x${string}`, feeBps: bps };
  }
  return null;
}

// ─── Payment platforms ────────────────────────────────────────────────────────

export interface PeerPaymentPlatform {
  key: string;
  displayName: string;
  /** Fiat currencies this platform commonly settles. First = default. */
  currencies: string[];
  needsTakerRegistration: boolean;
  offchainIdHint: string;
}

export const PEER_PAYMENT_PLATFORMS: PeerPaymentPlatform[] = [
  {
    key: "wise",
    displayName: "Wise",
    currencies: ["USD", "EUR", "GBP", "SGD", "AUD"],
    needsTakerRegistration: true,
    offchainIdHint: "Wisetag without @",
  },
  {
    key: "revolut",
    displayName: "Revolut",
    currencies: ["USD", "EUR", "GBP"],
    needsTakerRegistration: true,
    offchainIdHint: "Revtag without @",
  },
  {
    key: "venmo",
    displayName: "Venmo",
    currencies: ["USD"],
    needsTakerRegistration: true,
    offchainIdHint: "Venmo username, exact casing, no @",
  },
  {
    key: "cashapp",
    displayName: "Cash App",
    currencies: ["USD"],
    needsTakerRegistration: false,
    offchainIdHint: "cashtag without $",
  },
  {
    key: "paypal",
    displayName: "PayPal",
    currencies: ["USD", "EUR", "GBP"],
    needsTakerRegistration: true,
    offchainIdHint: "paypal.me username (no prefix)",
  },
  {
    key: "zelle",
    displayName: "Zelle",
    currencies: ["USD"],
    needsTakerRegistration: false,
    offchainIdHint: "lowercase email",
  },
  {
    key: "monzo",
    displayName: "Monzo",
    currencies: ["GBP"],
    needsTakerRegistration: false,
    offchainIdHint: "monzo.me name",
  },
  {
    key: "mercadopago",
    displayName: "Mercado Pago",
    currencies: ["ARS", "BRL", "MXN"],
    needsTakerRegistration: false,
    offchainIdHint: "22-digit CVU",
  },
  {
    key: "chime",
    displayName: "Chime",
    currencies: ["USD"],
    needsTakerRegistration: false,
    offchainIdHint: "$chimesign lowercase",
  },
  {
    key: "n26",
    displayName: "N26",
    currencies: ["EUR"],
    needsTakerRegistration: false,
    offchainIdHint: "IBAN, spaces removed",
  },
];

export function peerPlatform(key: string): PeerPaymentPlatform | undefined {
  return PEER_PAYMENT_PLATFORMS.find((p) => p.key === key);
}

// ─── Fiat currencies ──────────────────────────────────────────────────────────

export interface PeerFiatCurrency {
  code: string;
  symbol: string;
  flag: string;
  name: string;
}

export const PEER_FIAT_CURRENCIES: PeerFiatCurrency[] = [
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar" },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro" },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "British Pound" },
  { code: "SGD", symbol: "S$", flag: "🇸🇬", name: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", name: "Australian Dollar" },
  { code: "ARS", symbol: "$", flag: "🇦🇷", name: "Argentine Peso" },
  { code: "BRL", symbol: "R$", flag: "🇧🇷", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", flag: "🇲🇽", name: "Mexican Peso" },
];

export function platformsForCurrency(code: string): PeerPaymentPlatform[] {
  return PEER_PAYMENT_PLATFORMS.filter((p) => p.currencies.includes(code));
}

// ─── Decimal helpers (exact integer math — no floats near money) ──────────────

export const USDC_DECIMALS = 6;
export const RATE_DECIMALS = 18;

export function parseUnitsExact(value: string, decimals: number): bigint {
  const neg = value.startsWith("-");
  const v = neg ? value.slice(1) : value;
  const [whole, frac = ""] = v.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  const out = BigInt(digits || "0");
  return neg ? -out : out;
}

export function formatUnitsExact(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const v = (neg ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = v.slice(0, v.length - decimals);
  const frac = v.slice(v.length - decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** "100.5" USDC → 100500000n (6 dp). */
export const usdcToBaseUnits = (human: string): bigint => parseUnitsExact(human, USDC_DECIMALS);
/** 100500000n → "100.5". */
export const baseUnitsToUsdc = (base: bigint | string): string =>
  formatUnitsExact(BigInt(base), USDC_DECIMALS);
/** 1020000000000000000n → "1.02". */
export const rateFrom18 = (base: bigint | string): string =>
  formatUnitsExact(BigInt(base), RATE_DECIMALS);

// ─── Intent state machine (mirrors §9 of the integration plan) ────────────────

export type PeerIntentStatus =
  | "quoted"
  | "signaled"
  | "paid"
  | "proving"
  | "fulfilled"
  | "bridged"
  | "cancelled"
  | "failed";

export const PEER_INTENT_ACTIVE: PeerIntentStatus[] = ["quoted", "signaled", "paid", "proving"];

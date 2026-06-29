// Amount <-> raw conversion + display helpers. All FX Provider testnet tokens are 6dp,
// but never assume — always pass the token's decimals.

/** Human decimal string/number -> raw integer string (token base units). */
export function toRaw(amount: string | number, decimals: number): string {
  const s = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!s || !/^\d*\.?\d*$/.test(s)) throw new Error(`invalid amount: ${amount}`);
  const [intPart = "0", fracPart = ""] = s.split(".");
  const frac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const raw = `${intPart}${frac}`.replace(/^0+(?=\d)/, "");
  return raw === "" ? "0" : raw;
}

/** Raw integer string -> human decimal string (no trailing-zero noise). */
export function fromRaw(raw: string | bigint, decimals: number): string {
  const v = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  const neg = v < 0n;
  const abs = (neg ? -v : v).toString().padStart(decimals + 1, "0");
  const intPart = abs.slice(0, abs.length - decimals);
  const fracPart = abs.slice(abs.length - decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${fracPart ? `.${fracPart}` : ""}`;
}

/** Compact human-readable number for display. */
export function fmt(n: number, maxFrac = 6): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 1e-6) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

/**
 * USD value — always exactly 2 decimal places with comma grouping.
 * Use for all "$X.XX" displays so "$198" never appears where "$198.29" should.
 * Examples: 198.29 → "$198.29", 79.4 → "$79.40", 0 → "$0.00"
 */
export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Token amount — 2 to 4 decimal places, trimming trailing zeros beyond 2.
 * Prevents "118.8932" (too many dp) while keeping "0.0042" and "79.40" consistent.
 * Examples: 118.8932 → "118.89", 79.4 → "79.40", 0.000123 → "0.000123" (< 0.01 falls back to 6dp)
 */
export function fmtToken(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.01) {
    // Sub-cent: show up to 6dp so dust isn't shown as 0.00
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
  // Normal balances: 2dp (118.8932 -> 118.89). Stablecoins do not need 4dp noise.
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortAddr(a?: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

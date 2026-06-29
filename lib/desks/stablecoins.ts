// Curated allowlist of real mainnet stablecoins. We filter LiFi's 4000+ token
// list down to THESE symbols (LiFi supplies the verified address + decimals — we
// never hardcode addresses), then union with The FX provider's regional FX stables. Keeps
// the picker to genuine, liquid stablecoins instead of 1000+ LP/yield wrappers.
export const STABLE_SYMBOLS: string[] = [
  // USD
  "USDC",
  "USDT",
  "DAI",
  "USDe",
  "USDS",
  "PYUSD",
  "FRAX",
  "crvUSD",
  "LUSD",
  "GUSD",
  "USDP",
  "TUSD",
  "FDUSD",
  "USD1",
  "RLUSD",
  "USDG",
  "USDD",
  "GHO",
  "sUSD",
  // EUR
  "EURC",
  "EURe",
  "EURA",
  "agEUR",
  "EURS",
  "EURT",
  // GBP / SGD
  "GBPe",
  "XSGD",
];

const SYMBOL_FIAT: Record<string, string> = {
  agEUR: "EUR",
  EURA: "EUR",
  EURe: "EUR",
  EURC: "EUR",
  EURS: "EUR",
  EURT: "EUR",
  GBPe: "GBP",
  XSGD: "SGD",
};

/** Infer the fiat currency for a stablecoin symbol. */
export function fiatOf(symbol: string): string {
  if (SYMBOL_FIAT[symbol]) return SYMBOL_FIAT[symbol];
  const s = symbol.toUpperCase();
  for (const [sub, cur] of [
    ["EUR", "EUR"],
    ["GBP", "GBP"],
    ["JPY", "JPY"],
    ["CHF", "CHF"],
    ["SGD", "SGD"],
    ["AUD", "AUD"],
    ["CAD", "CAD"],
    ["USD", "USD"],
  ] as const) {
    if (s.includes(sub)) return cur;
  }
  return "USD";
}

const ALLOW = new Set(STABLE_SYMBOLS.map((s) => s.toLowerCase()));
export function isAllowedStable(symbol: string): boolean {
  return ALLOW.has(symbol.toLowerCase());
}

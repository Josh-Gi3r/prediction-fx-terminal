// ISO 4217 currency code -> flag emoji. Most codes' first two letters are the
// ISO 3166 country (USD->US, SGD->SG, MYR->MY). Specials handled explicitly.
const SPECIAL: Record<string, string> = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌎",
};

export function currencyFlag(code?: string | null): string {
  if (!code) return "🏳️";
  const c = code.toUpperCase();
  if (SPECIAL[c]) return SPECIAL[c];
  const cc = c.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  const base = 0x1f1e6;
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

// Currency display order: majors first, then alphabetical.
const PRIORITY = ["USD", "EUR", "GBP", "SGD", "JPY", "MYR", "PHP", "IDR", "CNH", "AUD"];
export function currencyRank(code?: string | null): number {
  if (!code) return 999;
  const i = PRIORITY.indexOf(code.toUpperCase());
  return i === -1 ? 100 : i;
}

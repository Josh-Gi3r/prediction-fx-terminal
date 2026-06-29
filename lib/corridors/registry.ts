import type { GasMode } from "@/lib/fx-provider";

export type CorridorRegion = "majors" | "latam" | "asia" | "emea" | "exotic";
export type VolTier = "major" | "mid" | "high" | "low";

export interface Corridor {
  /** Display symbol, e.g. "USDC/BRLV". Base = USDC always. */
  sym: string;
  /** Quote token ISO code (for /fx/rate lookups against USD). */
  isoBase: string;
  isoQuote: string;
  region: CorridorRegion;
  /** Human-readable currency name. */
  name: string;
  /** Stablecoin issuer for the quote token. */
  issuer: string;
  /** Per-corridor max leverage on the Differential perp surface. */
  maxLev: number;
  /** 8h funding rate as a fraction (0.0042 = 0.42% per 8h). Positive = longs pay. */
  fundingRate: number;
  /** Volatility tier scalar (1 = low, 2 = high). */
  volScalar: number;
  tier: VolTier;
  /** Deterministic sparkline seed. */
  seed: number;
  /** Mid rate used until live /fx/rate plugs in (Phase 7). */
  refRate: number;
  /** 24h % change at last snapshot. */
  refChg: number;
  /** Annualized basis (cost of carry) in %. */
  basis: number;
}

export const CORRIDORS: readonly Corridor[] = [
  {
    sym: "USDC/EURC",
    isoBase: "USD",
    isoQuote: "EUR",
    region: "majors",
    name: "Euro",
    issuer: "Circle",
    maxLev: 100,
    fundingRate: 0.0008,
    volScalar: 0.4,
    tier: "major",
    seed: 1,
    refRate: 0.9265,
    refChg: 0.12,
    basis: 1.6,
  },
  {
    sym: "USDC/JPYC",
    isoBase: "USD",
    isoQuote: "JPY",
    region: "majors",
    name: "Japanese Yen",
    issuer: "JPYC",
    maxLev: 100,
    fundingRate: 0.0012,
    volScalar: 0.5,
    tier: "major",
    seed: 2,
    refRate: 150.43,
    refChg: 0.31,
    basis: 2.4,
  },
  {
    sym: "USDC/TGBP",
    isoBase: "USD",
    isoQuote: "GBP",
    region: "majors",
    name: "British Pound",
    issuer: "TrueGBP",
    maxLev: 100,
    fundingRate: 0.0009,
    volScalar: 0.4,
    tier: "major",
    seed: 3,
    refRate: 0.7892,
    refChg: -0.04,
    basis: 1.8,
  },
  {
    sym: "USDC/XSGD",
    isoBase: "USD",
    isoQuote: "SGD",
    region: "asia",
    name: "Singapore Dollar",
    issuer: "StraitsX",
    maxLev: 50,
    fundingRate: 0.0014,
    volScalar: 0.8,
    tier: "mid",
    seed: 4,
    refRate: 1.3429,
    refChg: 0.08,
    basis: 2.1,
  },
  {
    sym: "USDC/BRLV",
    isoBase: "USD",
    isoQuote: "BRL",
    region: "latam",
    name: "Brazilian Real",
    issuer: "Transfero",
    maxLev: 50,
    fundingRate: 0.0042,
    volScalar: 1.4,
    tier: "mid",
    seed: 5,
    refRate: 5.1234,
    refChg: -0.18,
    basis: 4.2,
  },
  {
    sym: "USDC/MXNB",
    isoBase: "USD",
    isoQuote: "MXN",
    region: "latam",
    name: "Mexican Peso",
    issuer: "Bitso",
    maxLev: 50,
    fundingRate: 0.0036,
    volScalar: 1.2,
    tier: "mid",
    seed: 6,
    refRate: 18.452,
    refChg: 0.22,
    basis: 3.6,
  },
  {
    sym: "USDC/IDRT",
    isoBase: "USD",
    isoQuote: "IDR",
    region: "asia",
    name: "Indonesian Rupiah",
    issuer: "Rupiah Token",
    maxLev: 50,
    fundingRate: 0.0028,
    volScalar: 1.1,
    tier: "mid",
    seed: 7,
    refRate: 15728,
    refChg: -0.05,
    basis: 3.1,
  },
  {
    sym: "USDC/INRX",
    isoBase: "USD",
    isoQuote: "INR",
    region: "asia",
    name: "Indian Rupee",
    issuer: "—",
    maxLev: 50,
    fundingRate: 0.0026,
    volScalar: 1.0,
    tier: "mid",
    seed: 8,
    refRate: 83.62,
    refChg: 0.06,
    basis: 2.7,
  },
  {
    sym: "USDC/MYR",
    isoBase: "USD",
    isoQuote: "MYR",
    region: "asia",
    name: "Malaysian Ringgit",
    issuer: "MYR Token",
    maxLev: 50,
    fundingRate: 0.003,
    volScalar: 1.1,
    tier: "mid",
    seed: 9,
    refRate: 4.6198,
    refChg: 0.03,
    basis: 2.9,
  },
  {
    sym: "USDC/ZARP",
    isoBase: "USD",
    isoQuote: "ZAR",
    region: "emea",
    name: "South African Rand",
    issuer: "—",
    maxLev: 25,
    fundingRate: 0.0072,
    volScalar: 1.8,
    tier: "high",
    seed: 10,
    refRate: 18.74,
    refChg: -0.31,
    basis: 7.4,
  },
  {
    sym: "USDC/TRYB",
    isoBase: "USD",
    isoQuote: "TRY",
    region: "emea",
    name: "Turkish Lira",
    issuer: "BiLira",
    maxLev: 25,
    fundingRate: 0.0182,
    volScalar: 2.4,
    tier: "high",
    seed: 11,
    refRate: 34.27,
    refChg: 0.74,
    basis: 18.2,
  },
  {
    sym: "USDC/CNGN",
    isoBase: "USD",
    isoQuote: "NGN",
    region: "exotic",
    name: "Nigerian Naira",
    issuer: "Convexity",
    maxLev: 10,
    fundingRate: 0.0224,
    volScalar: 2.8,
    tier: "high",
    seed: 12,
    refRate: 1620.5,
    refChg: -0.42,
    basis: 22.4,
  },
] as const;

export const REGIONS: readonly { id: "all" | CorridorRegion; label: string }[] = [
  { id: "all", label: "All corridors" },
  { id: "majors", label: "Majors" },
  { id: "latam", label: "LatAm" },
  { id: "asia", label: "Asia" },
  { id: "emea", label: "EMEA" },
  { id: "exotic", label: "Exotic" },
] as const;

export function corridorBySym(sym: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.sym === sym);
}

export function filterCorridors(region: "all" | CorridorRegion): Corridor[] {
  if (region === "all") return [...CORRIDORS];
  return CORRIDORS.filter((c) => c.region === region);
}

/** Probability that BRL/USD settles below current — basis-skewed, deterministic noise. */
export function realisticYesProb(basis: number, seed: number): number {
  const noise = ((seed * 9301) % 100) / 1000 - 0.05;
  return Math.max(0.32, Math.min(0.68, 0.5 - basis * 0.004 + noise));
}

/** Spread in bps as a function of tier — used for the differential bid/ask split. */
export function spreadBps(tier: VolTier): number {
  switch (tier) {
    case "major":
      return 3;
    case "mid":
      return 8;
    case "high":
      return 16;
    case "low":
      return 36;
  }
}

export const DEFAULT_GAS_MODE: GasMode = "receive_less";

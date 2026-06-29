// Liquidity-source abstraction. FX provider (orderbook) + LiFi (meta-aggregator over
// every major DEX). Both quote the same token pair on Ethereum mainnet; the UI
// ranks them and the user picks.
import type { FxIntent, PermitEnvelope, SwapQuoteResponse } from "../fx-provider/core/types";

interface BaseQuote {
  amountInRaw: string;
  amountOutRaw: string; // venue's committed minimum output (fees + slippage already inside)
  /** Pre-gas / pre-slippage maker-quoted amount. Kept for executors that need
   *  the gross figure (e.g. The FX provider's routeParams reconstruction). Never shown in UI. */
  amountOutGrossRaw?: string;
  rate: number; // outHuman / inHuman (using amountOutRaw)
  feeUsd?: number;
  toolName: string;
  /** Estimated gas cost in USD for this desk.
   *  fx-provider: constant $0.40 estimate (settles ~250k gas on mainnet).
   *  lifi: from gasCosts[0].amountUSD.
   *  kyber: from routeSummary.gasUsd.
   *  cow: 0 (solver pays; fee already inside buyAmount). */
  gasUsd?: number;
  /** Net deliverable = amountOutRaw - gas converted to output-token units.
   *  This is the single number used for ranking, the Best badge, and the
   *  "You receive" headline. All three always use this same figure.
   *  Stored as a raw integer string (same decimals as amountOutRaw). */
  netOutRaw?: string;
}

export interface FxProviderQuote extends BaseQuote {
  source: "fx-provider";
  uuid: string;
  expiresAt: number;
  permitRequired: boolean;
  routeParams: FxIntent;
  permit?: PermitEnvelope | null;
  raw: SwapQuoteResponse;
}

export interface LifiQuote extends BaseQuote {
  source: "lifi";
  transactionRequest?: { to?: string; data?: string; value?: string; chainId?: number };
  /** Executable: input token + the spender that must be approved before the tx. */
  tokenIn?: string;
  approvalAddress?: string;
  raw: unknown;
}

export interface KyberQuote extends BaseQuote {
  source: "kyber";
  /** Pre-slippage amountOut with -50bps haircut for comparability. */
  haircutBps: number;
  /** Executable: token addresses + the full routeSummary for /route/build. */
  tokenIn: string;
  tokenOut: string;
  routeSummary: unknown;
  raw: unknown;
}

export interface CowQuote extends BaseQuote {
  source: "cow";
  /** Whether CoW marked this quote 'verified' (real solver vs unverifiable). */
  verified?: boolean;
  /** Executable: sellToken for the relayer approval + the full quote order params. */
  tokenIn: string;
  cowOrder: {
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    buyAmount: string;
    validTo: number;
    appData: string;
    feeAmount: string;
    kind: string;
    partiallyFillable: boolean;
    sellTokenBalance: string;
    buyTokenBalance: string;
  };
  raw: unknown;
}

export type NormalizedQuote = FxProviderQuote | LifiQuote | KyberQuote | CowQuote;

export type QuoteResult =
  | { ok: true; quote: NormalizedQuote }
  | { ok: false; reason: "no_liquidity" | "error"; message: string };

export interface QuoteParams {
  fromAddress: string;
  toAddress: string;
  fromAmountRaw: string;
  fromDecimals: number;
  toDecimals: number;
  owner?: string;
}

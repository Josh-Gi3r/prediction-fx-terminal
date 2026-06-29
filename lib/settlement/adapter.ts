/**
 * lib/settlement/adapter.ts
 *
 * Settlement provider adapter interface.
 *
 * The default implementation ships with `lib/fx-provider/` (FX provider CLOB).
 * To swap in a different settlement layer, implement this interface and point
 * the server-side quote functions at your adapter.
 *
 * Plugging in a new provider:
 *   1. Implement SettlementAdapter<QuoteT, IntentT, ReceiptT>.
 *   2. Export it from lib/settlement/index.ts as `defaultSettlementAdapter`.
 *   3. Update lib/server/quotes/settlement.ts to call your adapter.
 *
 * The contract flow the default FX provider adapter follows:
 *   GET  /api/config         → chain config (vault address, verifying contract, …)
 *   GET  /api/tokens         → supported token list
 *   POST /api/quotes         → multi-desk quote fanout, FX provider included
 *   POST /api/swap           → forward signed intent to settlement layer
 *   GET  /api/order-status   → poll settlement status by trade ID
 */

/** Typed settlement quote returned by the provider. */
export interface SettlementQuote {
  /** Unique single-use quote identifier (consumed on first submit). */
  quoteId: string;
  /** ISO8601 or epoch-ms expiry of this quote. */
  expiresAt: string | number;
  /** Input token contract address. */
  inputToken: string;
  /** Output token contract address. */
  outputToken: string;
  /** Input amount as raw integer string (no decimals). */
  amountInRaw: string;
  /** Committed minimum output as raw integer string (fees already deducted). */
  amountOutRaw: string;
  /** Whether the provider requires a Permit2 / EIP-2612 signature alongside the intent. */
  permitRequired: boolean;
  /** Full typed-data payload needed to build the EIP-712 intent signature. */
  typedData: unknown;
  /** Optional permit envelope for gasless flow. */
  permit?: unknown | null;
}

/** On-chain settlement confirmation returned after submit. */
export interface SettlementReceipt {
  /** Provider-specific trade identifier for status polling. */
  tradeId: string | null;
  /** Whether the submit was accepted. */
  accepted: boolean;
  /** Human-readable status from the provider. */
  status?: string;
}

/** Query parameters for a quote request. */
export interface SettlementQuoteParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amountRaw: string;
  fromDecimals: number;
  toDecimals: number;
  /** Taker / recipient address on-chain. */
  ownerAddress?: string;
}

/**
 * Settlement provider adapter.
 *
 * Implement this interface to swap out the default FX provider CLOB with any other
 * settlement layer (RFQ desk, AMM, OTC, …).
 */
export interface SettlementAdapter {
  /** Human-readable provider name — used in logs and UI labels. */
  readonly name: string;

  /** Fetch a quote for a token swap. */
  quote(params: SettlementQuoteParams): Promise<SettlementQuote>;

  /**
   * Submit a signed intent to the settlement layer.
   * Returns a receipt with a tradeId for status polling.
   */
  submit(opts: {
    quoteId: string;
    signature: string;
    permitSignature?: string;
    permitDeadline?: number;
  }): Promise<SettlementReceipt>;

  /** Poll for settlement status by tradeId. */
  getStatus(tradeId: string): Promise<{ status: string; settled: boolean }>;
}

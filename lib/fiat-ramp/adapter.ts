/**
 * lib/fiat-ramp/adapter.ts
 *
 * Fiat-to-crypto ramp adapter interface.
 *
 * The default implementation ships with `lib/peer/` (zkP2P protocol).
 * Feature flag: NEXT_PUBLIC_FEATURE_PEER=true enables the /cash surface.
 *
 * To swap in a different ramp (MoonPay, Ramp Network, Transak, …):
 *   1. Implement FiatRampAdapter.
 *   2. Export it from lib/fiat-ramp/index.ts as `defaultFiatRampAdapter`.
 *   3. Point app/cash/page.tsx and /api/p2p/* at your adapter.
 *
 * The zkP2P default adapter:
 *   - Settles on Base mainnet (chain 8453) in USDC.
 *   - Bridges onramped USDC to Ethereum mainnet for use in settlement.
 *   - Zero testnet — production and staging are both chain 8453.
 *
 * No secrets live here. The adapter config is purely a URL + chain config.
 */

export interface FiatRampQuote {
  /** Unique quote / intent identifier. */
  intentId: string;
  /** Fiat amount the user will send. */
  fiatAmount: string;
  /** Fiat currency code, e.g. "USD". */
  fiatCurrency: string;
  /** Expected crypto output as a raw integer string. */
  cryptoAmountRaw: string;
  /** Output token contract address. */
  cryptoToken: string;
  /** Output chain ID. */
  chainId: number;
  /** Rate at quote time. */
  rate: string;
}

export interface FiatRampAdapter {
  /** Human-readable provider name. */
  readonly name: string;
  /** Base chain ID where the ramp escrow lives. */
  readonly escrowChainId: number;
  /** Token delivered on the escrow chain. */
  readonly escrowToken: string;

  /**
   * Get a quote for a fiat → crypto conversion.
   * Returns null if no liquidity / provider unavailable.
   */
  getQuote(params: {
    fiatAmount: string;
    fiatCurrency: string;
    paymentPlatform: string;
    toToken: string;
    toChainId: number;
    takerAddress: string;
  }): Promise<FiatRampQuote | null>;

  /**
   * Get available vaults / offers (maker-provided liquidity).
   * Used by /api/p2p/vaults.
   */
  getVaults(params: {
    paymentPlatform?: string;
    fiatCurrency?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]>;
}

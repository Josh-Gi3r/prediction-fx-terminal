/**
 * lib/prediction-market/adapter.ts
 *
 * Prediction market provider adapter interface.
 *
 * The default implementation ships with `lib/polymarket/` (Polymarket CLOB).
 * Feature flag: NEXT_PUBLIC_FEATURE_PM_BETTING=true to enable live betting.
 *
 * To swap in a different prediction market (Manifold, Augur, Azuro, …):
 *   1. Implement PredictionMarketAdapter.
 *   2. Export it from lib/prediction-market/index.ts.
 *   3. Update app/api/pm/* routes to call your adapter.
 *
 * The Polymarket default adapter:
 *   - Uses the Polymarket CLOB API on Polygon mainnet (USDC).
 *   - Order signing via EIP-712 on-chain (CTF Exchange contract).
 *   - Builder attribution via server-side POLYMARKET_API_KEY/SECRET/PASSPHRASE.
 *   - Position read is keyless (public API).
 */

export interface PredictionMarket {
  /** Polymarket or equivalent market identifier. */
  conditionId: string;
  question: string;
  /** Probability / price in [0,1] that YES resolves. */
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  endDate: string;
  active: boolean;
}

export interface PredictionMarketPosition {
  conditionId: string;
  question: string;
  outcome: "YES" | "NO";
  /** Number of shares held. */
  shares: number;
  /** Average entry price. */
  avgPrice: number;
  currentPrice: number;
}

export interface PredictionMarketAdapter {
  /** Human-readable provider name. */
  readonly name: string;
  /** Chain ID where the market contracts live. */
  readonly chainId: number;
  /** Collateral token (e.g. USDC on Polygon). */
  readonly collateralToken: string;

  /**
   * Fetch open prediction markets, optionally filtered.
   * This is the read path — no credentials required.
   */
  getMarkets(params?: {
    limit?: number;
    offset?: number;
    active?: boolean;
    tags?: string[];
  }): Promise<PredictionMarket[]>;

  /**
   * Get a user's open positions.
   * Requires derivation of user API credentials (see lib/polymarket/useDeriveCreds).
   */
  getPositions(params: {
    walletAddress: string;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  }): Promise<PredictionMarketPosition[]>;

  /**
   * Sign and place a market order.
   * Server-side only — builder credentials are required.
   */
  placeOrder(params: {
    conditionId: string;
    outcome: "YES" | "NO";
    side: "BUY" | "SELL";
    sizeUsdc: string;
    limitPrice: string;
    userOrderSignature: string;
    walletAddress: string;
  }): Promise<{ orderId: string; status: string }>;
}

/**
 * lib/bridge/types.ts
 *
 * Shared types for the cross-chain bridge (Ethereum → Polygon USDC.e).
 */

/** POST /api/bridge-quote request body. */
export interface BridgeQuoteRequest {
  /** Source ERC-20 token address on Ethereum (USDC or USDT). */
  fromToken: string;
  /** Raw amount in source token's decimals. */
  fromAmountRaw: string;
  /** User's wallet address (fromAddress = toAddress — same wallet). */
  owner: string;
  /**
   * Request a gas-on-destination drop (POL for Polygon gas fees).
   *
   * NOTE: The LiFi `fromAmountForGas` param is NOT used here.
   * Real-world testing confirmed that `fromAmountForGas` causes
   * "No available quotes" on every viable route for this corridor
   * (Polygon PoS bridge, Across). The feature requires bridging-
   * protocol support for a destination call, which none of the
   * liquid ETH→Polygon USDC.e routes currently support.
   *
   * When true, the API annotates the response with a gasDropNote
   * so the UI can surface a POL-acquisition prompt alongside
   * the bridge transaction.
   */
  gasOnDestination: boolean;
}

/** POST /api/bridge-quote response body. */
export interface BridgeQuoteResponse {
  /** Minimum USDC.e received on Polygon (6 decimals, raw integer string). */
  toAmountMin: string;
  /** LiFi spender address that must be approved for fromToken on Ethereum. */
  approvalAddress: string;
  /**
   * Ready-to-send transaction object for Ethereum.
   * chainId is always 1 (Ethereum mainnet).
   */
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
  /** Estimated seconds until USDC.e lands on Polygon. */
  executionSeconds: number;
  /** Estimated Ethereum-side gas cost in USD. */
  gasUsd: number;
  /** Bridge tool name for display (e.g. "Polygon Bridge (PoS)"). */
  tool: string;
  /**
   * Present when gasOnDestination was true — informs the UI that
   * the user will need a small POL balance for the Polygon USDC.e
   * approve tx. Shown as an info note, not a blocking gate.
   */
  gasDropNote?: string;
}

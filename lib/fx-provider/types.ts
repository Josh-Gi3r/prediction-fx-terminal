/**
 * FX Provider Protocol API types
 * Mirrors https://docs.your-fx-provider.example.com/api-reference
 *
 * All amounts are raw uint256 decimal strings. Use `decimals` on the matching
 * token row to convert for display.
 */

export type Address = `0x${string}`;
export type HexString = `0x${string}`;
export type UuidString = string; // UUID4
export type UuidInt = string; // decimal uint256 string

// ============================================================
// System
// ============================================================

export type HealthStatus = "healthy" | "degraded";

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  timestamp: string;
  executor_id: number;
  relayer_executor_id: number | null;
  signature_ready: boolean;
}

export interface SystemTimeResponse {
  timestamp: number;
}

export interface Token {
  currency: string;
  symbol: string;
  address: Address;
  decimals: number;
  min_trade_amount_raw: string;
  min_trade_amount: string;
}

export interface TokensResponse {
  tokens: Token[];
}

export interface Market {
  symbol: string;
  base_symbol: string;
  quote_symbol: string;
  base_address: Address;
  quote_address: Address;
  tick_precision: number;
  quantity_precision: number;
  base_decimals: number;
  quote_decimals: number;
  min_ask_amount_raw: string;
  min_ask_amount: string;
  min_bid_quote_amount_raw: string;
  min_bid_quote_amount: string;
}

export interface MarketsResponse {
  markets: Market[];
}

export interface FxRateResponse {
  pair: string;
  rate: string;
  as_of: number;
  rate_24h_ago: string | null;
  as_of_24h_ago: number | null;
  change_pct: string | null;
}

export interface ConfigResponse {
  chain_id: number;
  settlement_address: Address;
  vault_address: Address;
  sor_address: Address;
  domain_separator: HexString;
  eip712_domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  limits: {
    vl_batch: { min: number; max: number };
  };
}

// ============================================================
// Account
// ============================================================

export interface Balance {
  token: Address;
  symbol: string;
  decimals: number;
  wallet_balance: string;
  vault_available: string;
  vault_frozen: string;
  vault_total: string;
  total: string;
}

export interface BalancesResponse {
  owner_address: Address;
  balances: Balance[];
  updated_at: string;
  wallet_balance_available: boolean;
}

// ============================================================
// Swaps
// ============================================================

export type GasMode = "receive_less" | "pay_more";

export interface SwapQuoteRequest {
  from_token: Address;
  to_token: Address;
  from_amount: string;
  owner_address: Address;
  recipient: Address;
  expiration: number;
  gas_mode?: GasMode;
}

export interface RouteParams {
  taker: Address;
  inputToken: Address;
  outputToken: Address;
  maxInputAmount: string;
  minOutputAmount: string;
  recipient: Address;
  initialDepositAmount: string;
  uuid: UuidInt;
  deadline: number;
}

export interface PermitInfo {
  permit_supported: boolean;
  permit_required: boolean;
  token: Address;
  spender: Address;
  owner: Address;
  value_raw: string;
  current_allowance_raw: string;
  nonce: number;
  suggested_deadline: number;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  eip712: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: Address;
    };
    primaryType: "Permit";
    types: {
      Permit: ReadonlyArray<{ name: string; type: string }>;
    };
    message: {
      owner: Address;
      spender: Address;
      value: string;
      nonce: number;
      deadline: number;
    };
  };
}

export interface SwapQuoteResponse {
  uuid: UuidString;
  route_params: RouteParams;
  fee_breakdown: {
    gas_cost_usd: string;
    gas_cost_from_token: string;
  };
  expires_at: number;
  permit: PermitInfo | null;
}

export interface SwapSubmitRequest {
  uuid: UuidString;
  signature: HexString;
  permit_signature?: HexString;
  permit_deadline?: number;
}

export interface SwapSubmitResponse {
  success: boolean;
  trade_id: string;
  status: "pending" | "matched" | "settled" | "cancelled" | "failed";
  fee_breakdown?: {
    gas_cost_usd: string;
    gas_cost_from_token: string;
  };
}

// ============================================================
// Orders
// ============================================================

export type OrderSide = "bid" | "ask";
export type OrderStatus = "pending" | "matched" | "settled" | "cancelled" | "failed";
export type OrderType = "limit" | "swap";

export interface PlaceOrderRequest {
  owner_address: Address;
  side: OrderSide;
  amount: string;
  price: string;
  order_type: "limit";
  from_address: Address;
  to_address: Address;
  order_id: UuidString;
  uuid_int: UuidInt;
  signature: HexString;
  expiration: number;
}

export interface PlaceOrderResponse {
  order_id: UuidString;
}

export interface SettlementSummary {
  status: "pending" | "settled" | "failed" | string;
  total_fill_count: number;
  pending_fill_count: number;
  settled_fill_count: number;
  failed_fill_count: number;
  reverted_fill_count: number;
  latest_settlement_id: number | null;
  latest_tx_hash: HexString | null;
  latest_parent_status: string | null;
  latest_fill_settlement_status: string | null;
  latest_failed_fill_failure_reason: string | null;
}

export interface SettlementLine {
  token: string;
  token_address: Address;
  amount: string;
  amount_raw: string;
}

export interface SettlementFee extends SettlementLine {
  type: string;
}

export interface SettlementEconomics {
  perspective_order_id: UuidString;
  gross_debits: SettlementLine[];
  gross_credits: SettlementLine[];
  balance_debits: SettlementLine[];
  balance_credits: SettlementLine[];
  fees_paid: SettlementFee[];
}

export type OrderErrorCode =
  | "ALLOWANCE_INSUFFICIENT"
  | "INTENT_DEADLINE_EXPIRED"
  | "SLIPPAGE_EXCEEDED"
  | "NO_LIQUIDITY"
  | "QUOTE_STALE"
  | "AMOUNT_BELOW_MIN"
  | "STP_BLOCKED"
  | "INSUFFICIENT_EQUITY"
  | "PAIR_INACTIVE"
  | "TRANSIENT_SETTLEMENT_FAILURE";

export interface Order {
  trade_id: UuidString;
  owner_address: Address;
  status: OrderStatus;
  order_type: OrderType;
  symbol: string;
  side: OrderSide;
  base_symbol: string;
  quote_symbol: string;
  base_token: Address;
  quote_token: Address;
  price: string;
  amount: string;
  remaining_amount: string;
  filled_base_amount: string;
  filled_quote_amount: string;
  notional: string;
  remaining_notional: string;
  from_token: Address;
  to_token: Address;
  from_amount: string;
  filled_amount: string;
  to_amount: string;
  created_at: string;
  updated_at: string;
  expiration: string | null;
  error: string | null;
  error_code: OrderErrorCode | null;
  uuid_int: UuidInt;
  vl_batch_id: UuidString | null;
  settlement_summary: SettlementSummary;
  settlement_economics: SettlementEconomics;
}

export interface ListOrdersResponse {
  trades: Order[];
  total: number;
}

// ============================================================
// Typed error envelope
// ============================================================

export interface FxProviderErrorEnvelope {
  detail:
    | string
    | {
        detail: string;
        error_code: string;
      };
}

export class FxApiError extends Error {
  override readonly name = "FxApiError";
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    public readonly raw: unknown,
  ) {
    super(message);
  }
}

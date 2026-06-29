/** FX Provider vault: balanceOf(token, user) — selector 0xf7888aec.
 *  ARG ORDER IS REVERSED from ERC-20 (token, user) — verified in gotchas memory. */
export const FX_VAULT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Types lifted from FX provider SDK types.
// Keep conservative; treat unknown fields as opaque.

export interface FxToken {
  symbol: string;
  address: string;
  decimals: number;
  /** ISO fiat tag, e.g. "USD","SGD","MYR". Live API uses `currency`. */
  currency?: string;
  fiat_currency?: string;
  name?: string;
  min_trade_amount?: number | string;
  min_trade_amount_raw?: string;
  sources?: ("fx-provider" | "lifi")[];
}

export interface FxConfig {
  chain_id: number;
  settlement_address: string;
  vault_address: string;
  sor_address: string;
  domain_separator?: string;
  eip712_domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  limits?: { vl_batch?: { min: number; max: number } };
}

export type GasMode = "receive_less" | "pay_more";

export interface SwapQuoteRequest {
  from_token: string;
  to_token: string;
  from_amount: string; // raw token units
  owner_address: string;
  recipient: string;
  expiration: number; // unix seconds
  gas_mode: GasMode;
}

/** EIP-712 Intent struct (= route_params). Signed under domain
 * {name:"<provider-eip712-name>",version:"1",chainId,verifyingContract:settlement_address}. */
export interface FxIntent {
  taker: string;
  inputToken: string;
  outputToken: string;
  maxInputAmount: string;
  minOutputAmount: string;
  recipient: string;
  initialDepositAmount: string;
  uuid: string;
  deadline: number; // uint48
}

export interface PermitEnvelope {
  permit_supported: boolean;
  permit_required: boolean;
  token: string;
  spender: string;
  owner: string;
  value_raw: string;
  current_allowance_raw: string;
  nonce: number;
  suggested_deadline: number;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  eip712: {
    domain: { name: string; version: string; chainId: number; verifyingContract: string };
    primaryType: "Permit";
    types: { Permit: Array<{ name: string; type: string }> };
    message: { owner: string; spender: string; value: string; nonce: number; deadline: number };
  };
}

export interface SwapQuoteResponse {
  uuid: string;
  route_params: FxIntent;
  fee_breakdown?: { gas_cost_usd?: string; gas_cost_from_token?: string };
  expires_at: number;
  permit?: PermitEnvelope | null;
  [k: string]: unknown;
}

export interface SwapExecuteRequest {
  uuid: string;
  signature: string;
  permit_signature?: string;
  permit_deadline?: number;
}

export interface SwapExecuteResponse {
  success: boolean;
  trade_id?: string;
  [k: string]: unknown;
}

export interface BalanceRow {
  symbol: string;
  address: string;
  decimals: number;
  wallet_balance: string; // raw uint256
  vault_available: string;
  vault_frozen: string;
}

export interface BalancesResponse {
  balances: BalanceRow[];
}

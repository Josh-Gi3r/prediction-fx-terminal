"use client";

/**
 * Client-side maker-order placement flow.
 *
 * 1. Build the typed Order struct (fromToken / toToken / amounts / uuid)
 * 2. Sign it via Privy → viem → wallet.signTypedData
 * 3. POST it to /orders
 *
 * Taker swaps do NOT live here anymore — they go through the audited
 * useSwap state machine (`lib/desks/useSwap.ts`) + server routes, which
 * builds the Intent from the quote and validates it before signing.
 */

import { exactToAmountRaw } from "@/lib/desks/vl";
import { ACTIVE_CHAIN } from "@/lib/privy/config";
import { v4 as uuidv4 } from "uuid";
import { fxClient } from "./client";
import { getFxProviderBaseUrl } from "./config";
import { toRaw } from "./core/format";
import { CancelOrderTypes, OrderTypes, encodeStandaloneUuid } from "./eip712";
import type { Address, HexString } from "./types";
import { FxApiError } from "./types";

/**
 * The one canonical place order amounts are computed. Exact integer math —
 * never `Number * 10 ** decimals` float chains (server reconstructs raw
 * amounts in Decimal; float drift = signature hash mismatch = rejection,
 * or worse, a wrong-amount order the user signs without noticing).
 *
 * Semantics (matches FX provider): `sizeBase` is the BASE-token quantity in human
 * units; `price` is quote-per-base. A bid buys base paying quote (signed
 * fromToken = quote); an ask sells base for quote (signed fromToken = base).
 */
export function buildOrderAmounts(args: {
  side: "bid" | "ask";
  /** Base-token quantity, human units (decimal string). */
  sizeBase: string;
  /** Quote per base, human units (decimal string). */
  price: string;
  baseDecimals: number;
  quoteDecimals: number;
}): { fromAmountRaw: string; toAmountRaw: string } {
  const baseAmtRaw = toRaw(args.sizeBase, args.baseDecimals);
  const quoteRaw = exactToAmountRaw(args.sizeBase, args.price, args.quoteDecimals).toString();
  return args.side === "bid"
    ? { fromAmountRaw: quoteRaw, toAmountRaw: baseAmtRaw }
    : { fromAmountRaw: baseAmtRaw, toAmountRaw: quoteRaw };
}

function assertChain(domain: { chainId: number }): void {
  // Refuse to sign against a domain that doesn't match the app's active chain
  // (mainnet API + sepolia wallet — or vice versa — silently produces orders
  // that can never settle, or signs against the wrong environment).
  if (domain.chainId !== ACTIVE_CHAIN.id) {
    throw new FxApiError(
      400,
      null,
      `Chain mismatch: FX Provider domain chainId=${domain.chainId}, app chain=${ACTIVE_CHAIN.id}`,
      null,
    );
  }
}

interface SignerLike {
  /** Returns the connected wallet address. */
  address: Address;
  /** EIP-712 typed-data signer; matches viem's `signTypedData`. */
  signTypedData: (args: {
    domain: { name: string; version: string; chainId: number; verifyingContract: Address };
    types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<HexString>;
}

export interface PlaceLimitOrderArgs {
  signer: SignerLike;
  side: "bid" | "ask";
  /** Base token (market base — what's being bought on a bid, sold on an ask). */
  fromAddress: Address;
  /** Quote token. */
  toAddress: Address;
  /** Natural-unit quantity (base side). */
  amount: string;
  /** Natural-unit price (quote per base). */
  price: string;
  /** Raw uint256 from-amount in token decimals. */
  fromAmountRaw: string;
  /** Raw uint256 to-amount in token decimals. */
  toAmountRaw: string;
  /** Unix expiration (must be in the future, ≤ 365 days minus 300s skew guard). */
  expiration: number;
}

export interface PlaceLimitOrderResult {
  orderId: string;
  uuidInt: string;
  signature: HexString;
}

/**
 * Build, sign, and submit a limit order. Throws FxApiError on rejection.
 * Caller is responsible for handling typed error codes (NO_LIQUIDITY,
 * INSUFFICIENT_EQUITY, AMOUNT_BELOW_MIN, etc).
 */
export async function placeLimitOrder(args: PlaceLimitOrderArgs): Promise<PlaceLimitOrderResult> {
  const { signer } = args;

  // Expiration sanity: in the future, under the provider's 365d − 300s ceiling.
  const now = Math.floor(Date.now() / 1000);
  if (args.expiration <= now + 60 || args.expiration > now + 365 * 86_400 - 300) {
    throw new FxApiError(400, "INTENT_DEADLINE_EXPIRED", "Order expiration out of range", null);
  }

  const orderId = uuidv4();
  const cfg = await fxClient.config();
  assertChain(cfg.eip712_domain);
  const executorId = (await fxClient.health()).executor_id;
  // executor_id is a 4-bit field inside the signed uuid; a hostile/buggy
  // server response must not be able to smuggle arbitrary high bits in.
  if (!Number.isInteger(executorId) || executorId < 0 || executorId > 15) {
    throw new FxApiError(502, null, `Unexpected executor_id from /health: ${executorId}`, null);
  }
  const uuidInt = encodeStandaloneUuid(orderId, executorId);

  const message = {
    user: signer.address,
    expiration: args.expiration,
    feeBps: 0,
    recipient: "0x0000000000000000000000000000000000000000",
    fromToken: args.side === "bid" ? args.toAddress : args.fromAddress,
    toToken: args.side === "bid" ? args.fromAddress : args.toAddress,
    fromAmount: BigInt(args.fromAmountRaw).toString(),
    toAmount: BigInt(args.toAmountRaw).toString(),
    initialDepositAmount: "0",
    uuid: uuidInt,
  } as const;

  const signature = await signer.signTypedData({
    domain: cfg.eip712_domain,
    types: { Order: [...OrderTypes.Order] },
    primaryType: "Order",
    message,
  });

  await fxClient.placeOrder({
    owner_address: signer.address,
    side: args.side,
    amount: args.amount,
    price: args.price,
    order_type: "limit",
    from_address: args.fromAddress,
    to_address: args.toAddress,
    order_id: orderId,
    uuid_int: uuidInt,
    signature,
    expiration: args.expiration,
  });

  return { orderId, uuidInt, signature };
}

export interface CancelOrderArgs {
  signer: SignerLike;
  orderId: string;
  uuidInt: string;
}

export async function cancelOrder({ signer, orderId, uuidInt }: CancelOrderArgs): Promise<void> {
  const cfg = await fxClient.config();
  assertChain(cfg.eip712_domain);
  const signature = await signer.signTypedData({
    domain: cfg.eip712_domain,
    types: { CancelOrder: [...CancelOrderTypes.CancelOrder] },
    primaryType: "CancelOrder",
    message: { owner: signer.address, orderId: uuidInt },
  });
  // Call /orders/cancel via the typed client
  const url = `${getFxProviderBaseUrl()}/orders/cancel`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_address: signer.address,
      order_id: orderId,
      uuid_int: uuidInt,
      signature,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new FxApiError(res.status, null, text, null);
  }
}

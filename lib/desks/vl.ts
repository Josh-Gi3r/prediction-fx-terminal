import { toRaw } from "../fx-provider/core/format";
// VL batch assembler. Given a budget token + per-leg specs, produce N OrderStructs
// that share owner + fromToken + group_id, with sequential leg_ids. Each is signed
// separately by the user's wallet via wagmi `signTypedData`, then submitted as
// one batch to POST /orders/vl/batch.
import type { OrderStruct } from "../fx-provider/core/order";
import { groupIdFor, makeOrderId, makeVlSibling } from "../fx-provider/core/uuidInt";

/**
 * Exact raw `toAmount` = amount × price (human) × 10^toDecimals, computed with
 * integer math — NEVER JS float. Float multiply (`amount * price`) loses precision
 * on high-magnitude quotes (e.g. ITRY ~36k/USDC), producing a `toAmount` that
 * differs from The FX provider's `Decimal` reconstruction → signature mismatch.
 * Floor (ROUND_DOWN) verified against FX provider /verify-signature 2026-05-31.
 */
export function exactToAmountRaw(
  amount: number | string,
  price: number | string,
  toDecimals: number,
): bigint {
  const aStr = String(amount);
  const pStr = String(price);
  const aD = (aStr.split(".")[1] || "").length;
  const pD = (pStr.split(".")[1] || "").length;
  const aN = BigInt(aStr.replace(".", ""));
  const pN = BigInt(pStr.replace(".", ""));
  return (aN * pN * 10n ** BigInt(toDecimals)) / 10n ** BigInt(aD + pD);
}

export interface VlLegSpec {
  /** Counter token (the token the LP wants when this leg fills). */
  toToken: `0x${string}`;
  toDecimals: number;
  /** Side: "sell" budget → fromAmount=budget, toAmount=quote; "buy" inverts the same math.
   * For a one-sided LP using a USDC budget across many corridors, side is typically "sell". */
  side: "sell" | "buy";
  /** Human amount to offer on this leg (in budget-token units when side=sell). */
  amount: number;
  /** Price expressed as quote-per-base (i.e. how much toToken per fromToken). */
  price: number;
}

export interface VlBatchInputs {
  owner: `0x${string}`;
  fromToken: `0x${string}`;
  fromDecimals: number;
  /** uint48 unix seconds; e.g. now + 6*3600 for a 6-hour TTL. */
  expiration: number;
  feeBps?: number; // default 0 for makers
  executorId?: bigint; // from /health (mainnet default 0n)
  legs: VlLegSpec[]; // 2..50 (we cap UI at 20)
}

export interface AssembledLeg {
  order: OrderStruct;
  order_id: string; // UUID4 string (must accompany signed struct in REST body)
  side: "sell" | "buy";
}

/** Assemble a VL batch. Builds N OrderStructs sharing one group_id; the first
 * leg's order_id is the canonical primary (== vl_batch_id used for cancels). */
export function assembleVlBatch(inputs: VlBatchInputs): AssembledLeg[] {
  if (inputs.legs.length < 2) throw new Error("VL batch requires >= 2 legs");
  if (inputs.legs.length > 50) throw new Error("VL batch capped at 50 legs (provider limit)");

  const executorId = inputs.executorId ?? 0n;
  const feeBps = inputs.feeBps ?? 0;

  // Primary leg seeds group_id.
  const primary = makeOrderId(executorId);
  const groupId = groupIdFor(primary.order_id);

  return inputs.legs.map((leg, idx) => {
    const idPair = idx === 0 ? primary : makeVlSibling(groupId, idx, executorId);
    const fromAmount = BigInt(toRaw(leg.amount, inputs.fromDecimals));
    const toAmount = exactToAmountRaw(leg.amount, leg.price, leg.toDecimals);
    const order: OrderStruct = {
      user: inputs.owner,
      expiration: inputs.expiration,
      feeBps,
      // recipient = address(0) keeps proceeds in vault ledger (LP can withdraw later).
      recipient: "0x0000000000000000000000000000000000000000",
      fromToken: inputs.fromToken,
      toToken: leg.toToken,
      fromAmount,
      toAmount,
      initialDepositAmount: 0n, // vault-funded; LP must pre-deposit budget
      uuid: BigInt(idPair.uuid_int),
    };
    return { order, order_id: idPair.order_id, side: leg.side };
  });
}

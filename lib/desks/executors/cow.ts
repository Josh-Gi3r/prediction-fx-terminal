// CoW venue executor: approve RELAYER → sign order → submit → poll /api/cow-status.
import type { Address } from "viem";
import type { CowQuote } from "../source";
import type { ApprovalDetail, SettledReceipt } from "../useSwap";
import { cowApprovalAmount, ensureAllowance } from "./approve";
import {
  CONFIRM_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  formatTokenAmount,
  getSymbolFromAddress,
  sleep,
} from "./shared";

const COW_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110" as const;
const COW_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as const;

const COW_TYPES = {
  Order: [
    { name: "sellToken", type: "address" },
    { name: "buyToken", type: "address" },
    { name: "receiver", type: "address" },
    { name: "sellAmount", type: "uint256" },
    { name: "buyAmount", type: "uint256" },
    { name: "validTo", type: "uint32" },
    { name: "appData", type: "bytes32" },
    { name: "feeAmount", type: "uint256" },
    { name: "kind", type: "string" },
    { name: "partiallyFillable", type: "bool" },
    { name: "sellTokenBalance", type: "string" },
    { name: "buyTokenBalance", type: "string" },
  ],
} as const;

export interface CowExecutorCallbacks {
  onApprovalNeeded: (detail: ApprovalDetail) => void;
  onApprovalDone: () => void;
  onSigning: () => void;
  onSubmitting: () => void;
  onConfirming: (orderUid: string) => void;
  onSuccess: (receipt: SettledReceipt) => void;
  onError: (err: string) => void;
  onUnconfirmed: () => void;
}

/** Execute a CoW swap: approve → sign EIP-712 order → submit → poll cow-status. */
export async function executeCow(
  quote: CowQuote,
  address: `0x${string}`,
  signal: AbortSignal,
  signTypedDataAsync: (params: unknown) => Promise<`0x${string}`>,
  callbacks: CowExecutorCallbacks,
): Promise<void> {
  const co = quote.cowOrder;
  const need = cowApprovalAmount(co.sellAmount, co.feeAmount);

  await ensureAllowance(quote.tokenIn as Address, COW_RELAYER, need, address, {
    onApprovalNeeded: callbacks.onApprovalNeeded,
    onApprovalDone: callbacks.onApprovalDone,
  });

  callbacks.onSigning();
  const signature = await signTypedDataAsync({
    domain: {
      name: "Gnosis Protocol",
      version: "v2",
      chainId: 1,
      verifyingContract: COW_SETTLEMENT,
    },
    types: COW_TYPES,
    primaryType: "Order",
    message: {
      sellToken: co.sellToken as `0x${string}`,
      buyToken: co.buyToken as `0x${string}`,
      receiver: address,
      sellAmount: BigInt(co.sellAmount),
      buyAmount: BigInt(co.buyAmount),
      validTo: co.validTo,
      appData: co.appData as `0x${string}`,
      feeAmount: BigInt(co.feeAmount),
      kind: co.kind,
      partiallyFillable: co.partiallyFillable,
      sellTokenBalance: co.sellTokenBalance,
      buyTokenBalance: co.buyTokenBalance,
    },
  });

  callbacks.onSubmitting();
  const res = await fetch("/api/cow-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sellToken: co.sellToken,
      buyToken: co.buyToken,
      receiver: address,
      sellAmount: co.sellAmount,
      buyAmount: co.buyAmount,
      validTo: co.validTo,
      appData: co.appData,
      feeAmount: co.feeAmount,
      kind: co.kind,
      partiallyFillable: co.partiallyFillable,
      sellTokenBalance: co.sellTokenBalance,
      buyTokenBalance: co.buyTokenBalance,
      signingScheme: "eip712",
      signature,
      from: address,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const uid = typeof data.orderUid === "string" ? data.orderUid : "";
  callbacks.onConfirming(uid);

  // CoW output token info from quote.
  const outputDecimals = quote.raw
    ? ((quote.raw as { buyToken?: { decimals?: number } }).buyToken?.decimals ?? 6)
    : 6;
  const outputSymbol = getSymbolFromAddress(co.buyToken) ?? "tokens";

  await confirmCow(uid, signal, outputSymbol, outputDecimals, callbacks);
}

/** Poll /api/cow-status until terminal or timeout. */
export async function confirmCow(
  orderUid: string,
  signal: AbortSignal,
  outputSymbol: string,
  outputDecimals: number,
  callbacks: Pick<CowExecutorCallbacks, "onSuccess" | "onError" | "onUnconfirmed">,
): Promise<void> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline && !signal.aborted) {
    await sleep(POLL_INTERVAL_MS);
    if (signal.aborted) return;

    try {
      const res = await fetch(`/api/cow-status?order_uid=${encodeURIComponent(orderUid)}`, {
        signal,
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        terminal?: boolean;
        fulfilled?: boolean;
        failed?: boolean;
        executed_buy_amount?: string | null;
      };

      if (!data.terminal) continue;

      if (data.fulfilled) {
        const humanAmount = data.executed_buy_amount
          ? formatTokenAmount(BigInt(data.executed_buy_amount), outputDecimals)
          : "confirmed";
        callbacks.onSuccess({ amount: humanAmount, symbol: outputSymbol });
        return;
      }
      // expired or cancelled
      callbacks.onError("CoW order expired or cancelled without fill.");
      return;
    } catch (e) {
      if (signal.aborted) return;
      // Network error during poll — keep trying until deadline.
    }
  }

  if (!signal.aborted) callbacks.onUnconfirmed();
}

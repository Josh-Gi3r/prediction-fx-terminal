// LiFi venue executor: send transaction → wait for on-chain receipt + balance delta.
import { waitForTransactionReceipt } from "@wagmi/core";
import { getAddress } from "viem";
import { wagmiConfig } from "../../wagmi/config";
import type { LifiQuote } from "../source";
import type { ApprovalDetail, SettledReceipt } from "../useSwap";
import { ensureAllowance } from "./approve";
import { CONFIRM_TIMEOUT_MS, formatTokenAmount, readBalanceOf } from "./shared";

// ─── P1-7: LiFi spender allowlist ─────────────────────────────────────────────
// We only approve addresses we know are legitimate LiFi router/diamond contracts.
// If the upstream quote returns a different spender we reject before touching the
// wallet — a compromised or tampered quote cannot phish an unlimited approval.
//
// Ethereum mainnet:
//   LiFi Diamond  0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE
//   LiFi Receiver 0x5439f8900aF5E1a2AEd0F5C9Ab21e8D24Bc1E7C7 (fee forwarder)
// Checksum form used for getAddress() equality checks.
const LIFI_ALLOWED_SPENDERS = new Set<string>([
  getAddress("0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE"), // LiFi Diamond (mainnet)
  getAddress("0x5439f8900aF5E1a2AEd0F5C9Ab21e8D24Bc1E7C7"), // LiFi Receiver
]);

export interface LifiExecutorCallbacks {
  onApprovalNeeded: (detail: ApprovalDetail) => void;
  onApprovalDone: () => void;
  onSubmitting: () => void;
  onConfirming: (hash: `0x${string}`) => void;
  onSuccess: (receipt: SettledReceipt) => void;
  onError: (err: string) => void;
  onUnconfirmed: () => void;
}

/** Extract output token info from a LiFi quote. Best-effort — returns null if absent. */
export function extractLifiOutputToken(
  quote: LifiQuote,
): { address: string; decimals: number; symbol: string } | null {
  const raw = quote.raw as {
    action?: { toToken?: { address?: string; decimals?: number; symbol?: string } };
  };
  const t = raw?.action?.toToken;
  if (t?.address) {
    return { address: t.address, decimals: t.decimals ?? 6, symbol: t.symbol ?? "tokens" };
  }
  return null;
}

/** Execute a LiFi swap: sendTransaction → confirmOnChain. */
export async function executeLifi(
  quote: LifiQuote,
  address: `0x${string}`,
  signal: AbortSignal,
  sendTransactionAsync: (params: {
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: bigint;
  }) => Promise<`0x${string}`>,
  callbacks: LifiExecutorCallbacks,
): Promise<void> {
  const tx = quote.transactionRequest;
  if (!tx?.to) throw new Error("LiFi returned no transaction");

  // Approve the LiFi spender for the exact input amount before the swap tx —
  // without this the router's transferFrom reverts (TRANSFER_FROM_FAILED).
  //
  // P1-7: Pin to the known LiFi diamond / router allowlist. Reject any spender
  // address that is not in the allowlist — a tampered quote cannot redirect an
  // approval to an arbitrary address.
  const rawSpender = quote.approvalAddress ?? tx.to;
  let spender: `0x${string}`;
  try {
    spender = getAddress(rawSpender) as `0x${string}`;
  } catch {
    throw new Error(`LiFi quote returned an invalid spender address: ${rawSpender}`);
  }
  if (!LIFI_ALLOWED_SPENDERS.has(spender)) {
    throw new Error(
      `LiFi quote spender ${spender} is not in the known router allowlist. Refusing to approve.`,
    );
  }

  if (quote.tokenIn && quote.amountInRaw) {
    await ensureAllowance(
      quote.tokenIn as `0x${string}`,
      spender,
      BigInt(quote.amountInRaw),
      address,
      {
        onApprovalNeeded: callbacks.onApprovalNeeded,
        onApprovalDone: callbacks.onApprovalDone,
      },
    );
  }

  const outputToken = extractLifiOutputToken(quote);
  const outputDecimals = outputToken?.decimals ?? 6;
  const outputSymbol = outputToken?.symbol ?? "tokens";
  const balanceBefore = outputToken
    ? await readBalanceOf(outputToken.address as `0x${string}`, address)
    : 0n;

  callbacks.onSubmitting();
  const hash = await sendTransactionAsync({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}` | undefined,
    value: tx.value ? BigInt(tx.value) : undefined,
  });
  callbacks.onConfirming(hash);

  await confirmOnChain(
    hash,
    signal,
    outputToken?.address ?? "",
    outputDecimals,
    outputSymbol,
    address,
    balanceBefore,
    callbacks,
  );
}

/** Wait for an on-chain tx receipt; verify via balance delta. Used by both LiFi and Kyber. */
export async function confirmOnChain(
  hash: `0x${string}`,
  signal: AbortSignal,
  outputTokenAddress: string,
  outputDecimals: number,
  outputSymbol: string,
  walletAddress: `0x${string}`,
  balanceBefore: bigint,
  callbacks: Pick<LifiExecutorCallbacks, "onSuccess" | "onError" | "onUnconfirmed">,
): Promise<void> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  try {
    const rec = await Promise.race([
      waitForTransactionReceipt(wagmiConfig, { hash }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), deadline - Date.now()),
      ),
    ]);
    if (signal.aborted) return;

    if (rec.status === "reverted") {
      callbacks.onError("Transaction reverted on-chain.");
      return;
    }

    // Balance delta as the source of truth.
    const balanceAfter = await readBalanceOf(outputTokenAddress as `0x${string}`, walletAddress);
    if (signal.aborted) return;

    const delta = balanceAfter - balanceBefore;
    if (delta > 0n) {
      callbacks.onSuccess({
        amount: formatTokenAmount(delta, outputDecimals),
        symbol: outputSymbol,
      });
    } else {
      // Tx succeeded but balance didn't change (edge case: same-address wrap etc.).
      callbacks.onSuccess({ amount: "confirmed", symbol: outputSymbol });
    }
  } catch (e) {
    if (signal.aborted) return;
    const msg = (e as Error).message ?? "";
    if (msg === "timeout") {
      callbacks.onUnconfirmed();
    } else {
      callbacks.onError(msg || "Transaction failed.");
    }
  }
}

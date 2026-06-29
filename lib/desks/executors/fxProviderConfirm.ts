// FX provider settlement confirmation: poll /api/order-status + balance-delta verification.
// Also exports the balance-delta-only fallback for when trade_id is absent.
import type { SettledReceipt } from "../useSwap";
import {
  CONFIRM_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  formatTokenAmount,
  readBalanceOf,
  sleep,
} from "./shared";

export interface FxConfirmCallbacks {
  onSuccess: (receipt: SettledReceipt) => void;
  onError: (err: string) => void;
  onUnconfirmed: () => void;
  on401: () => void;
}

/**
 * Poll /api/order-status to terminal; cross-check every tick with balance delta.
 * 401 → sets the flag and falls through to a final balance check.
 * NEVER auto-retries after timeout — late FX provider settlement = double-execution.
 */
export async function confirmFxProvider(
  tradeId: string,
  signal: AbortSignal,
  outputTokenAddress: string,
  outputDecimals: number,
  outputSymbol: string,
  walletAddress: `0x${string}`,
  balanceBefore: bigint,
  callbacks: FxConfirmCallbacks,
): Promise<void> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;

  while (Date.now() < deadline && !signal.aborted) {
    await sleep(POLL_INTERVAL_MS);
    if (signal.aborted) return;

    try {
      const res = await fetch(`/api/order-status?trade_id=${encodeURIComponent(tradeId)}`, {
        signal,
        cache: "no-store",
      });

      // 401 means no API key — stop polling immediately, fall through to balance-delta.
      if (res.status === 401) {
        callbacks.on401();
        break;
      }

      if (!res.ok) continue;

      const data = (await res.json()) as {
        terminal?: boolean;
        settled?: boolean;
        failed?: boolean;
        filled_amount?: string | null;
        to_amount?: string | null;
        error?: string | null;
        error_code?: string | null;
      };

      if (data.terminal) {
        if (data.failed) {
          // Verify with balance before giving up — statuses lie.
          const balanceAfter = await readBalanceOf(
            outputTokenAddress as `0x${string}`,
            walletAddress,
          );
          if (signal.aborted) return;

          const delta = balanceAfter - balanceBefore;
          if (delta > 0n) {
            // Status said failed but funds arrived — trust the chain.
            callbacks.onSuccess({
              amount: formatTokenAmount(delta, outputDecimals),
              symbol: outputSymbol,
            });
            return;
          }
          const errMsg = data.error_code
            ? `Swap failed: ${data.error_code}`
            : (data.error ?? "Swap failed on the FX provider.");
          callbacks.onError(errMsg);
          return;
        }

        if (data.settled) {
          // Confirm with balance delta.
          const balanceAfter = await readBalanceOf(
            outputTokenAddress as `0x${string}`,
            walletAddress,
          );
          if (signal.aborted) return;

          const delta = balanceAfter - balanceBefore;
          const humanAmount =
            delta > 0n
              ? formatTokenAmount(delta, outputDecimals)
              : data.filled_amount
                ? formatTokenAmount(BigInt(data.filled_amount), outputDecimals)
                : "confirmed";
          callbacks.onSuccess({ amount: humanAmount, symbol: outputSymbol });
          return;
        }
      }

      // Not yet terminal: also check balance delta opportunistically.
      // The FX provider can settle on-chain while the API still shows "pending".
      const balanceAfter = await readBalanceOf(outputTokenAddress as `0x${string}`, walletAddress);
      if (signal.aborted) return;

      const delta = balanceAfter - balanceBefore;
      if (delta > 0n) {
        callbacks.onSuccess({
          amount: formatTokenAmount(delta, outputDecimals),
          symbol: outputSymbol,
        });
        return;
      }
    } catch (e) {
      if (signal.aborted) return;
      // Network error — keep polling until deadline.
    }
  }

  if (!signal.aborted) {
    // Last balance check before giving up.
    try {
      const balanceAfter = await readBalanceOf(outputTokenAddress as `0x${string}`, walletAddress);
      const delta = balanceAfter - balanceBefore;
      if (delta > 0n) {
        callbacks.onSuccess({
          amount: formatTokenAmount(delta, outputDecimals),
          symbol: outputSymbol,
        });
        return;
      }
    } catch {
      // swallow
    }
    callbacks.onUnconfirmed();
  }
}

/**
 * Fallback for the FX provider when trade_id is missing: poll balance delta only.
 */
export async function confirmFxProviderByBalanceDelta(
  signal: AbortSignal,
  outputTokenAddress: `0x${string}`,
  outputDecimals: number,
  outputSymbol: string,
  walletAddress: `0x${string}`,
  balanceBefore: bigint,
  callbacks: Pick<FxConfirmCallbacks, "onSuccess" | "onUnconfirmed">,
): Promise<void> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline && !signal.aborted) {
    await sleep(POLL_INTERVAL_MS);
    if (signal.aborted) return;
    try {
      const after = await readBalanceOf(outputTokenAddress, walletAddress);
      const delta = after - balanceBefore;
      if (delta > 0n) {
        callbacks.onSuccess({
          amount: formatTokenAmount(delta, outputDecimals),
          symbol: outputSymbol,
        });
        return;
      }
    } catch {
      // keep polling
    }
  }
  if (!signal.aborted) callbacks.onUnconfirmed();
}

/** Decision helper: given raw API response fields, compute settlement decision.
 *  Exported for unit testing without fetch/network. */
export function fxTerminalDecision(data: {
  terminal?: boolean;
  settled?: boolean;
  failed?: boolean;
  error?: string | null;
  error_code?: string | null;
}): "settled" | "failed" | "pending" {
  if (!data.terminal) return "pending";
  if (data.settled) return "settled";
  if (data.failed) return "failed";
  return "pending";
}

/** Build the error message for a failed FX provider terminal. */
export function fxFailedErrorMessage(data: {
  error?: string | null;
  error_code?: string | null;
}): string {
  return data.error_code
    ? `Swap failed: ${data.error_code}`
    : (data.error ?? "Swap failed on the FX provider.");
}

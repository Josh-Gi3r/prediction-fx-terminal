import { getAddress } from "viem";
// FX provider executor: sign intent → optional permit sign → submit → confirm.
import { buildIntentTypedData, buildPermitTypedData } from "../../fx-provider/core/intent";
import type { FxConfig } from "../../fx-provider/core/types";
import type { FxProviderQuote } from "../source";
import type { SettledReceipt } from "../useSwap";
import { confirmFxProvider, confirmFxProviderByBalanceDelta } from "./fxProviderConfirm";
import { readBalanceOf } from "./shared";

export interface FxExecutorCallbacks {
  onSigning: () => void;
  onSigningPermit: () => void;
  onSubmitting: () => void;
  onConfirming: (tradeId: string | null) => void;
  onSuccess: (receipt: SettledReceipt) => void;
  onError: (err: string) => void;
  onUnconfirmed: () => void;
  on401: () => void;
}

/** Execute a FX provider swap: sign → permit? → submit → confirm or balance-delta fallback. */
export async function executeFxProvider(
  quote: FxProviderQuote,
  config: FxConfig,
  address: `0x${string}`,
  signal: AbortSignal,
  signTypedDataAsync: (params: unknown) => Promise<`0x${string}`>,
  callbacks: FxExecutorCallbacks,
): Promise<void> {
  // ─── P0-2 / P0-3: Assert intent belongs to the connected wallet ────────────
  // The intent (routeParams) comes from the server quote. Before signing, verify
  // that recipient and taker both equal the connected address. A MITM or a stale
  // quote for a different owner would otherwise result in the user signing away
  // funds to a different recipient.
  const normalizedAddress = getAddress(address);
  const normalizedRecipient = getAddress(quote.routeParams.recipient);
  const normalizedTaker = getAddress(quote.routeParams.taker);

  if (normalizedRecipient !== normalizedAddress) {
    throw new Error(
      `FX provider intent recipient (${normalizedRecipient}) does not match connected wallet (${normalizedAddress}). Refusing to sign.`,
    );
  }
  if (normalizedTaker !== normalizedAddress) {
    throw new Error(
      `FX provider intent taker (${normalizedTaker}) does not match connected wallet (${normalizedAddress}). Refusing to sign.`,
    );
  }

  // Snapshot output-token balance BEFORE submit.
  const outputTokenAddr = quote.routeParams.outputToken as `0x${string}`;
  // FX provider stablecoins are always 6 decimals.
  const outputDecimals = 6;
  // getSymbolFromAddress returns null here; callers fall back to "tokens".
  const outputSymbol = "tokens";
  const balanceBefore = await readBalanceOf(outputTokenAddr, address);

  callbacks.onSigning();
  const intentTd = buildIntentTypedData(quote.routeParams, config);
  const signature = await signTypedDataAsync(intentTd);

  let permit_signature: string | undefined;
  let permit_deadline: number | undefined;
  if (quote.permit) {
    // ─── P0-3: Assert permit spender and value before signing ───────────────
    // The permit.eip712.message comes verbatim from the upstream quote. Assert:
    //   spender  === settlement_address (the FX provider settlement contract)
    //   value    === maxInputAmount (reject if larger — exact-amount discipline)
    //   verifyingContract === inputToken (permit is on the input ERC-20)
    //   owner    === connected address
    const pm = quote.permit.eip712.message;
    const pd = quote.permit.eip712.domain;

    const permitOwner = getAddress(pm.owner);
    if (permitOwner !== normalizedAddress) {
      throw new Error(
        `Permit owner (${permitOwner}) does not match connected wallet (${normalizedAddress}). Refusing to sign.`,
      );
    }

    const permitSpender = getAddress(pm.spender);
    const expectedSpender = getAddress(config.settlement_address);
    if (permitSpender !== expectedSpender) {
      throw new Error(
        `Permit spender (${permitSpender}) is not the FX provider settlement contract (${expectedSpender}). Refusing to sign.`,
      );
    }

    const permitValue = BigInt(pm.value);
    const maxInput = BigInt(quote.routeParams.maxInputAmount);
    if (permitValue > maxInput) {
      throw new Error(
        `Permit value (${permitValue}) exceeds maxInputAmount (${maxInput}). Refusing to sign.`,
      );
    }

    const permitContract = getAddress(pd.verifyingContract);
    const inputToken = getAddress(quote.routeParams.inputToken);
    if (permitContract !== inputToken) {
      throw new Error(
        `Permit verifyingContract (${permitContract}) does not match inputToken (${inputToken}). Refusing to sign.`,
      );
    }

    callbacks.onSigningPermit();
    const permitTd = buildPermitTypedData(quote.permit);
    permit_signature = await signTypedDataAsync(permitTd);
    permit_deadline = quote.permit.eip712.message.deadline;
  }

  callbacks.onSubmitting();
  const submitRes = await fetch("/api/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uuid: quote.uuid, signature, permit_signature, permit_deadline }),
  });
  const submitData = await submitRes.json();
  if (!submitRes.ok || submitData.error || submitData.success === false) {
    throw new Error(submitData.error ?? "swap failed");
  }

  const tradeIdValue = submitData.trade_id ?? submitData.tradeId ?? null;
  callbacks.onConfirming(tradeIdValue);

  // ⚠️ NEVER auto-retry here — late settlement = double-execution.
  if (tradeIdValue) {
    await confirmFxProvider(
      tradeIdValue,
      signal,
      outputTokenAddr,
      outputDecimals,
      outputSymbol,
      address,
      balanceBefore,
      {
        onSuccess: callbacks.onSuccess,
        onError: callbacks.onError,
        onUnconfirmed: callbacks.onUnconfirmed,
        on401: callbacks.on401,
      },
    );
  } else {
    // No trade_id returned — can only use balance delta.
    await confirmFxProviderByBalanceDelta(
      signal,
      outputTokenAddr,
      outputDecimals,
      outputSymbol,
      address,
      balanceBefore,
      {
        onSuccess: callbacks.onSuccess,
        onUnconfirmed: callbacks.onUnconfirmed,
      },
    );
  }
}

// Kyber venue executor: build route → approve → send → confirm on-chain.
import type { Address } from "viem";
import { getAddress } from "viem";
import type { KyberQuote } from "../source";
import type { ApprovalDetail, SettledReceipt } from "../useSwap";
import { kyberApprovalAmount } from "./approve";
import { ensureAllowance } from "./approve";
import { confirmOnChain } from "./lifi";
import { readBalanceOf } from "./shared";

// ─── P1-7: Kyber router allowlist ─────────────────────────────────────────────
// The router address comes from /api/kyber-build (routerAddress field), which in
// turn reflects what KyberSwap's aggregator API returns. We pin to the known
// KyberSwap MetaAggregation router on Ethereum mainnet. If the build response
// returns a different address we reject before approving — a compromised or
// misconfigured build endpoint cannot redirect an approval elsewhere.
//
// Ethereum mainnet:
//   KyberSwap MetaAgg router v2  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
const KYBER_ALLOWED_ROUTERS = new Set<string>([
  getAddress("0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"), // KyberSwap MetaAgg v2 (mainnet)
]);

export interface KyberExecutorCallbacks {
  onApprovalNeeded: (detail: ApprovalDetail) => void;
  onApprovalDone: () => void;
  onSubmitting: () => void;
  onConfirming: (hash: `0x${string}`) => void;
  onSuccess: (receipt: SettledReceipt) => void;
  onError: (err: string) => void;
  onUnconfirmed: () => void;
}

/** Extract output token info from a Kyber quote. */
export function extractKyberOutputToken(quote: KyberQuote): {
  address: string;
  decimals: number;
  symbol: string;
} {
  return { address: quote.tokenOut, decimals: 6, symbol: "tokens" };
}

/** Execute a Kyber swap: build → allowance check → approve? → send → confirmOnChain. */
export async function executeKyber(
  quote: KyberQuote,
  address: `0x${string}`,
  signal: AbortSignal,
  sendTransactionAsync: (params: {
    to: `0x${string}`;
    data?: `0x${string}`;
  }) => Promise<`0x${string}`>,
  callbacks: KyberExecutorCallbacks,
): Promise<void> {
  const buildRes = await fetch("/api/kyber-build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      routeSummary: quote.routeSummary,
      sender: address,
      recipient: address,
    }),
  });
  const build = await buildRes.json();
  if (build.error || !build.routerAddress || !build.data) {
    throw new Error(build.error ?? "Kyber build failed");
  }

  // P1-7: Verify the router address is in the known allowlist before approving.
  let router: Address;
  try {
    router = getAddress(build.routerAddress) as Address;
  } catch {
    throw new Error(`Kyber build returned an invalid router address: ${build.routerAddress}`);
  }
  if (!KYBER_ALLOWED_ROUTERS.has(router)) {
    throw new Error(
      `Kyber build router ${router} is not in the known router allowlist. Refusing to approve.`,
    );
  }

  const tokenIn = quote.tokenIn as Address;
  const amountIn = kyberApprovalAmount(quote.amountInRaw);

  await ensureAllowance(tokenIn, router, amountIn, address, {
    onApprovalNeeded: callbacks.onApprovalNeeded,
    onApprovalDone: callbacks.onApprovalDone,
  });

  const outputToken = extractKyberOutputToken(quote);
  const outputDecimals = outputToken.decimals;
  const outputSymbol = outputToken.symbol;
  const balanceBefore = await readBalanceOf(outputToken.address as `0x${string}`, address);

  callbacks.onSubmitting();
  const hash = await sendTransactionAsync({
    to: router,
    data: build.data as `0x${string}`,
  });
  callbacks.onConfirming(hash);

  await confirmOnChain(
    hash,
    signal,
    outputToken.address,
    outputDecimals,
    outputSymbol,
    address,
    balanceBefore,
    {
      onSuccess: callbacks.onSuccess,
      onError: callbacks.onError,
      onUnconfirmed: callbacks.onUnconfirmed,
    },
  );
}

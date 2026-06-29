"use client";

import { FAUCET_ABI, FAUCET_ADDRESS } from "@/lib/desks/faucet";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export function FaucetButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Faucet is testnet-only (Sepolia). No faucet on mainnet.
  if (!isConnected || chainId !== 11155111) return null;

  const busy = isPending || confirming;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() =>
          writeContract({
            address: FAUCET_ADDRESS,
            abi: FAUCET_ABI,
            functionName: "claimTo",
            args: [address!],
          })
        }
        disabled={busy}
        title="Mint all 117 test stablecoins to your wallet (~0.056 ETH gas, one-time)"
        className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition hover:text-fg disabled:opacity-50"
      >
        {isPending
          ? "Confirm in wallet…"
          : confirming
            ? "Minting…"
            : isSuccess
              ? "Minted ✓"
              : "Get test tokens"}
      </button>
      {error && (
        <span className="max-w-[200px] text-right text-[10px] text-danger">
          {error.message.slice(0, 80)}
        </span>
      )}
      {isSuccess && <span className="text-[10px] text-success">~5s for tokens to appear</span>}
    </div>
  );
}

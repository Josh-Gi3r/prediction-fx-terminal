"use client";

import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { shortAddr } from "@/lib/fx-provider/core/format";
import { CHAIN } from "@/lib/wagmi/config";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <ConnectWalletButton
        label="Connect Wallet"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
      />
    );
  }

  const wrongChain = chainId !== CHAIN.id;

  return (
    <div className="flex items-center gap-2">
      {wrongChain ? (
        <button
          type="button"
          onClick={() => switchChain({ chainId: CHAIN.id })}
          className="rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium text-warning ring-1 ring-warning/40 transition hover:bg-warning/25"
        >
          Switch to {CHAIN.name}
        </button>
      ) : (
        <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium text-muted ring-1 ring-border">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {CHAIN.name}
        </span>
      )}
      <button
        type="button"
        onClick={() => disconnect()}
        title="Disconnect"
        className="tabular rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-fg ring-1 ring-border transition hover:ring-border-strong"
      >
        {shortAddr(address)}
      </button>
    </div>
  );
}

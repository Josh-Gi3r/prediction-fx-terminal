"use client";

import { AAVE_V3_MAINNET, POOL_ABI } from "@/lib/desks/aave";
import { useAaveBalances, useAaveReserves } from "@/lib/desks/aaveHooks";
import { fmt, fromRaw, toRaw } from "@/lib/fx-provider/core/format";
import { useState } from "react";
import { erc20Abi } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "../ConnectButton";
import { EarnSection } from "./shared";

type Reserve = ReturnType<typeof useAaveReserves>["reserves"][number];

// ─── AavePanel ────────────────────────────────────────────────────────────────
export function AavePanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { reserves } = useAaveReserves();
  const { balances } = useAaveBalances(address);

  return (
    <EarnSection
      title="Aave v3 · passive lending"
      subtitle="Supply stablecoins, earn the live supply APY. Withdraw anytime. aTokens accrue in your wallet."
    >
      {chainId !== 1 && (
        <div
          style={{
            marginBottom: 8,
            borderRadius: 9,
            border: "1px solid rgba(240,172,67,.4)",
            background: "rgba(240,172,67,.08)",
            padding: "8px 12px",
            fontSize: 12,
            color: "#8a5f0a",
          }}
        >
          Aave v3 is mainnet-only. Switch to Ethereum mainnet to supply.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reserves.map((r) => (
          <AaveRow
            key={r.symbol}
            reserve={r}
            owner={address}
            isConnected={isConnected}
            onChain={chainId === 1}
            aBalanceRaw={balances[r.symbol]}
          />
        ))}
      </div>
    </EarnSection>
  );
}

// ─── AaveRow ──────────────────────────────────────────────────────────────────
function AaveRow({
  reserve,
  owner,
  isConnected,
  onChain,
  aBalanceRaw,
}: {
  reserve: Reserve;
  owner?: `0x${string}`;
  isConnected: boolean;
  onChain: boolean;
  aBalanceRaw?: bigint;
}) {
  const [open, setOpen] = useState(false);
  const human = aBalanceRaw ? Number(fromRaw(aBalanceRaw, reserve.decimals)) : 0;
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--bg-soft)",
        borderRadius: 13,
        padding: "11px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>{reserve.symbol}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              color: "var(--yes)",
              fontSize: 14,
            }}
          >
            {reserve.apyPct > 0 ? `${reserve.apyPct.toFixed(2)}%` : "—"}
          </span>
          {isConnected && human > 0 && (
            <span style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "var(--muted)" }}>
              {fmt(human, 4)} supplied
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!isConnected || !onChain}
            style={{
              fontFamily: "var(--f-tech)",
              fontWeight: 700,
              fontSize: 12,
              background: "var(--grad-brand)",
              color: "#fff",
              border: 0,
              borderRadius: 9,
              padding: "8px 15px",
              cursor: !isConnected || !onChain ? "not-allowed" : "pointer",
              opacity: !isConnected || !onChain ? 0.4 : 1,
            }}
          >
            {open ? "Close" : "Supply"}
          </button>
        </span>
      </div>
      {open && isConnected && onChain && owner && (
        <SupplyForm reserve={reserve} owner={owner} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

// ─── SupplyForm ───────────────────────────────────────────────────────────────
function SupplyForm({
  reserve,
  owner,
  onClose,
}: {
  reserve: Reserve;
  owner: `0x${string}`;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const { data: walletBal } = useReadContract({
    address: reserve.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  const { data: allowance } = useReadContract({
    address: reserve.underlying,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, AAVE_V3_MAINNET.Pool as `0x${string}`],
  });
  const {
    data: approveHash,
    writeContract: writeApprove,
    isPending: approving,
  } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const { data: supplyHash, writeContract: writeSupply, isPending: supplying } = useWriteContract();
  const { isLoading: supplyConfirming, isSuccess: supplied } = useWaitForTransactionReceipt({
    hash: supplyHash,
  });

  const walletHuman = walletBal ? Number(fromRaw(walletBal, reserve.decimals)) : 0;
  const hasAmount = !!amount && Number(amount) > 0;
  let raw = 0n;
  try {
    if (hasAmount) raw = BigInt(toRaw(amount, reserve.decimals));
  } catch {}
  const needsApprove = !!raw && (allowance ?? 0n) < raw;

  function doApprove() {
    writeApprove({
      address: reserve.underlying,
      abi: erc20Abi,
      functionName: "approve",
      args: [AAVE_V3_MAINNET.Pool as `0x${string}`, raw],
    });
  }
  function doSupply() {
    writeSupply({
      address: AAVE_V3_MAINNET.Pool as `0x${string}`,
      abi: POOL_ABI,
      functionName: "supply",
      args: [reserve.underlying, raw, owner, 0],
    });
  }

  const busy = approving || approveConfirming || supplying || supplyConfirming;

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        border: "1px solid var(--line)",
        borderRadius: 11,
        background: "#fff",
        padding: 12,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <span>Amount</span>
        <button
          type="button"
          onClick={() => setAmount(String(walletHuman))}
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 11.5,
            color: "var(--brand)",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {fmt(walletHuman, 4)} {reserve.symbol} · Max
        </button>
      </div>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
        placeholder="0.0"
        style={{
          border: "1px solid var(--line)",
          borderRadius: 9,
          background: "var(--bg-soft)",
          padding: "9px 12px",
          textAlign: "right",
          fontFamily: "var(--f-tech)",
          fontSize: 18,
          outline: "none",
          width: "100%",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={needsApprove ? doApprove : doSupply}
          disabled={!hasAmount || busy || raw > (walletBal ?? 0n)}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 9,
            border: 0,
            background: "var(--grad-brand)",
            color: "#fff",
            fontFamily: "var(--f-ui)",
            fontWeight: 700,
            fontSize: 13,
            cursor: !hasAmount || busy ? "not-allowed" : "pointer",
            opacity: !hasAmount || busy ? 0.4 : 1,
          }}
        >
          {supplied
            ? "Supplied ✓"
            : supplying || supplyConfirming
              ? "Supplying…"
              : approved && !needsApprove
                ? "Supply"
                : approving || approveConfirming
                  ? "Approving…"
                  : needsApprove
                    ? "Approve"
                    : "Supply"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "9px 14px",
            borderRadius: 9,
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            fontFamily: "var(--f-ui)",
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {supplied && (
        <div style={{ fontSize: 12, color: "var(--yes)" }}>
          Position will appear above within ~15s.
        </div>
      )}
    </div>
  );
}

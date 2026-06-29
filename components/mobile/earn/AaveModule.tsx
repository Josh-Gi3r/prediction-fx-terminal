"use client";

/**
 * components/mobile/earn/AaveModule.tsx
 * Aave v3 supply — real on-chain flow (Ethereum mainnet, chain 1).
 * Hook pattern: wagmi useWriteContract + useWaitForTransactionReceipt.
 */

import { AAVE_V3_MAINNET, POOL_ABI } from "@/lib/desks/aave";
import { useAaveReserves } from "@/lib/desks/aaveHooks";
import { fmt, fromRaw, toRaw } from "@/lib/fx-provider/core/format";
import { openExternal } from "@/lib/telegram/openExternal";
import { useEffect, useState } from "react";
import { erc20Abi } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ChainBanner, ErrBanner, MobileConnectButton, OkBanner } from "./primitives";

type AaveReserve = ReturnType<typeof useAaveReserves>["reserves"][number];

function AaveSupplyPanel({
  reserve,
  owner,
  onClose,
}: {
  reserve: AaveReserve;
  owner: `0x${string}`;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");

  const { data: walletBal } = useReadContract({
    address: reserve.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
    chainId: 1,
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: reserve.underlying,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, AAVE_V3_MAINNET.Pool as `0x${string}`],
    chainId: 1,
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

  // After approve tx confirms, re-read allowance so the button re-evaluates
  useEffect(() => {
    if (approved) {
      refetchAllowance().catch(() => null);
    }
  }, [approved, refetchAllowance]);

  function doApprove() {
    writeApprove({
      address: reserve.underlying,
      abi: erc20Abi,
      functionName: "approve",
      args: [AAVE_V3_MAINNET.Pool as `0x${string}`, raw],
      chainId: 1,
    });
  }
  function doSupply() {
    writeSupply({
      address: AAVE_V3_MAINNET.Pool as `0x${string}`,
      abi: POOL_ABI,
      functionName: "supply",
      args: [reserve.underlying, raw, owner, 0],
      chainId: 1,
    });
  }

  const busy = approving || approveConfirming || supplying || supplyConfirming;

  const btnLabel = () => {
    if (supplied) return "Supplied";
    if (supplying || supplyConfirming) return "Supplying…";
    if (approveConfirming) return "Approving…";
    if (approving) return "Sign approve…";
    if (needsApprove) return "Approve";
    return "Supply";
  };

  return (
    <div className="inline-panel">
      <div className="efield">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <span className="eyebrow-sm">Amount</span>
          <button
            type="button"
            className="max-btn"
            onClick={() => setAmount(String(walletHuman))}
            disabled={walletHuman === 0}
          >
            {fmt(walletHuman, 4)} {reserve.symbol} · Max
          </button>
        </div>
        <div className="ebudget">
          <span className="ccy">{reserve.symbol}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
            placeholder="0.0"
            disabled={busy}
          />
        </div>
      </div>

      {supplied ? (
        <OkBanner>
          <strong>
            Supplied {amount} {reserve.symbol}
          </strong>
          <div style={{ fontSize: 11, marginTop: 3, opacity: 0.75 }}>
            aToken balance will appear in your wallet within ~15s.
          </div>
          {supplyHash && (
            <button
              type="button"
              onClick={() => openExternal(`https://etherscan.io/tx/${supplyHash}`)}
              style={{
                fontSize: 11,
                color: "var(--brand)",
                display: "block",
                marginTop: 4,
                background: "none",
                border: 0,
                cursor: "pointer",
                padding: 0,
                fontFamily: "var(--f-ui)",
              }}
            >
              View on Etherscan
            </button>
          )}
        </OkBanner>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={needsApprove ? doApprove : doSupply}
            disabled={!hasAmount || busy || raw > (walletBal ?? 0n)}
          >
            {btnLabel()}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function AaveRow({ reserve }: { reserve: AaveReserve }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const onChain = chainId === 1;

  return (
    <div className="arow-wrap">
      <div className="arow">
        <span className="sym">{reserve.symbol}</span>
        <span className="apy">{reserve.apyPct > 0 ? `${reserve.apyPct.toFixed(2)}%` : "—"}</span>
        {!isConnected ? (
          <MobileConnectButton />
        ) : !onChain ? (
          <button
            type="button"
            className="btn-sm-outline"
            onClick={() => switchChain({ chainId: 1 })}
          >
            Mainnet
          </button>
        ) : (
          <button type="button" className="btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Supply"}
          </button>
        )}
      </div>
      {isConnected && !onChain && open && (
        <ChainBanner label="Aave v3 is on Ethereum mainnet." chainId={1} />
      )}
      {open && isConnected && onChain && address && (
        <AaveSupplyPanel reserve={reserve} owner={address} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

export function AaveModule() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { reserves: aave } = useAaveReserves();
  const onChain = chainId === 1;

  return (
    <div className="emod">
      <div className="emod-h">
        <h3>Aave v3 · passive lending</h3>
        <p>
          Supply stablecoins, earn the live supply APY. Withdraw anytime; aTokens accrue in your
          wallet.
        </p>
      </div>
      {isConnected && !onChain && (
        <ChainBanner label="Aave v3 is on Ethereum mainnet." chainId={1} />
      )}
      <div style={{ marginTop: 14 }}>
        {aave.map((r) => (
          <AaveRow key={r.symbol} reserve={r} />
        ))}
      </div>
    </div>
  );
}

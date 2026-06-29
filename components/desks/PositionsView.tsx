"use client";

import { useAaveBalances, useAaveReserves } from "@/lib/desks/aaveHooks";
import { useConfig, useTokens } from "@/lib/desks/hooks";
import { type StoredVlBatch, getVlBatches, removeVlBatch } from "@/lib/desks/vlStore";
import { fmt, fromRaw } from "@/lib/fx-provider/core/format";
import { buildCancelVlBatchTypedData } from "@/lib/fx-provider/core/order";
import { FX_VAULT_ABI, type FxToken } from "@/lib/fx-provider/core/types";
import { CONTRACT_DEFAULTS } from "@/config/contracts";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts, useSignTypedData } from "wagmi";
import { ConnectButton } from "./ConnectButton";

export function PositionsView() {
  const { address, isConnected } = useAccount();
  const { data: tokens } = useTokens();
  const { data: config } = useConfig();
  const vault = (config?.vault_address ??
    CONTRACT_DEFAULTS[1]!.vault) as `0x${string}`;

  // Read settlement vault balances for every curated token (multicall via wagmi).
  const tokenList = tokens ?? [];
  const { data: vaultRaws, isLoading: vaultLoading } = useReadContracts({
    allowFailure: true,
    contracts: tokenList.map((t) => ({
      address: vault,
      abi: FX_VAULT_ABI,
      functionName: "balanceOf" as const,
      args: [t.address as `0x${string}`, address as `0x${string}`],
    })),
    query: { enabled: !!address && tokenList.length > 0, refetchInterval: 30_000 },
  });

  const fxVault = useMemo(() => {
    if (!vaultRaws) return [];
    return tokenList
      .map((t, i) => {
        const r = vaultRaws[i];
        if (r?.status !== "success" || typeof r.result !== "bigint" || r.result === 0n) return null;
        const human = Number(fromRaw(r.result, t.decimals));
        return { token: t, raw: r.result, human };
      })
      .filter((x): x is { token: FxToken; raw: bigint; human: number } => !!x)
      .sort((a, b) => b.human - a.human);
  }, [vaultRaws, tokenList]);

  const { reserves } = useAaveReserves();
  const { balances: aaveBalances } = useAaveBalances(address);
  const aavePositions = useMemo(
    () =>
      reserves
        .map((r) => {
          const raw = aaveBalances[r.symbol];
          if (!raw || raw === 0n) return null;
          return { reserve: r, raw, human: Number(fromRaw(raw, r.decimals)) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.human - a.human),
    [reserves, aaveBalances],
  );

  // Active VL batches (client-side store, per wallet).
  const [batches, setBatches] = useState<StoredVlBatch[]>([]);
  useEffect(() => {
    setBatches(getVlBatches(address));
  }, [address]);
  const { signTypedDataAsync } = useSignTypedData();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  async function cancelBatch(b: StoredVlBatch) {
    if (!config || !address) return;
    setCancelMsg(null);
    setCancelling(b.vlBatchId);
    try {
      const td = buildCancelVlBatchTypedData(address, b.vlBatchId, config);
      const signature = await signTypedDataAsync(
        td as unknown as Parameters<typeof signTypedDataAsync>[0],
      );
      const res = await fetch("/api/vl/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner_address: address, vl_batch_id: b.vlBatchId, signature }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "cancel rejected");
      removeVlBatch(b.vlBatchId);
      setBatches(getVlBatches(address));
      setCancelMsg(`Cancelled ${b.vlBatchId.slice(0, 10)}`);
    } catch (e) {
      setCancelMsg((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    } finally {
      setCancelling(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-border bg-paper p-8 text-center shadow-card">
        <div className="eyebrow">Positions</div>
        <h2 className="mt-3 font-display text-3xl font-medium text-ink">
          Connect to see what you hold
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Your vault balances, Aave supplies, and active VL batches will show here.
        </p>
        <div className="mt-5 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const fxVaultTotal = fxVault.reduce((s, r) => s + r.human, 0);
  const aaveTotal = aavePositions.reduce((s, r) => s + r.human, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryTile label="Vault" amount={fxVaultTotal} count={fxVault.length} />
        <SummaryTile label="Aave supplied" amount={aaveTotal} count={aavePositions.length} />
        <SummaryTile
          label="Active VL batches"
          amount={batches.length}
          count={batches.length}
          note="maker offers across FX corridors"
        />
      </div>

      {/* settlement vault */}
      <section className="rounded-2xl border border-border bg-paper p-5 shadow-card">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow">Vault · idle balances</div>
            <h3 className="mt-1 font-display text-xl font-medium text-ink">
              Idle balance, ready to swap or use in a VL batch
            </h3>
          </div>
        </div>
        {vaultLoading && (
          <div className="mt-3 space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                key={i}
                className="h-9 animate-pulse rounded-md bg-surface-2"
              />
            ))}
          </div>
        )}
        {!vaultLoading && fxVault.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            No idle vault balances. Swap or deposit to start.
          </p>
        )}
        {fxVault.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {fxVault.map((p) => (
              <li
                key={p.token.address}
                className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{p.token.symbol}</span>
                <span className="text-xs text-muted">{p.token.currency ?? "—"}</span>
                <span className="tabular text-right">{fmt(p.human, 4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Aave supplies */}
      <section className="rounded-2xl border border-border bg-paper p-5 shadow-card">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow">Aave v3 supplies · earning live APY</div>
            <h3 className="mt-1 font-display text-xl font-medium text-ink">
              aTokens accrue interest in real time
            </h3>
          </div>
        </div>
        {aavePositions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No Aave supplies. Supply from the Earn tab.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {aavePositions.map((p) => (
              <li
                key={p.reserve.symbol}
                className="grid grid-cols-[1fr_0.6fr_1fr] items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{p.reserve.symbol}</span>
                <span className="tabular text-xs text-success">
                  {p.reserve.apyPct.toFixed(2)}% APY
                </span>
                <span className="tabular text-right">{fmt(p.human, 4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* VL batches */}
      <section className="rounded-2xl border border-border bg-paper p-5 shadow-card">
        <div className="eyebrow">Virtual Liquidity · active batches</div>
        <h3 className="mt-1 font-display text-xl font-medium text-ink">
          One budget, many FX corridors
        </h3>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No active VL batches. Post one from the Earn tab: pick corridors, set prices, sign once.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {batches.map((b) => (
              <li key={b.vlBatchId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="tabular text-sm font-medium text-ink">
                      {b.vlBatchId.slice(0, 14)}…
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {b.amount} {b.budgetSymbol} · {b.legs.length} legs ·{" "}
                      {b.legs
                        .map((l) => l.symbol)
                        .slice(0, 6)
                        .join(", ")}
                      {b.legs.length > 6 ? "…" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelBatch(b)}
                    disabled={cancelling === b.vlBatchId}
                    className="shrink-0 rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/20 disabled:opacity-50"
                  >
                    {cancelling === b.vlBatchId ? "Sign cancel…" : "Cancel"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {cancelMsg && <div className="mt-2 text-xs text-muted">{cancelMsg}</div>}
        <p className="mt-2 text-[10px] text-faint">
          Tracked locally. Cancel signs a CancelVLBatch struct. Only your wallet can cancel your
          batch.
        </p>
      </section>
    </div>
  );
}

function SummaryTile({
  label,
  amount,
  count,
  note,
}: {
  label: string;
  amount: number;
  count: number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-paper p-5 shadow-card">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-medium text-ink">{fmt(amount, 2)}</span>
        <span className="text-xs text-muted">
          {count > 0 ? `· ${count} position${count === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {note && <div className="mt-1 text-[10px] text-faint">{note}</div>}
    </div>
  );
}

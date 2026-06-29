"use client";

/**
 * FX Vault detail page — live stats, daily chart, rates table, delegation.
 *
 * Data sources:
 *   - /api/p2p/vaults        → vault list (name, fee, lifetime stats)
 *   - /api/p2p/vaults/[id]   → daily snapshots + vault rate updates
 *   - Zkp2pClient.setRateManager → real onchain delegation (EscrowV2)
 *   - Zkp2pClient.getAccountDeposits → user's live deposits
 *
 * Delegation mechanism: EscrowV2 "v2" route — sets a rate manager directly
 * on an EXISTING deposit via client.setRateManager({ depositId, rateManagerAddress,
 * rateManagerId }). The vault must expose rateManagerAddress and rateManagerId
 * from the indexer (available in /api/p2p/vaults via the RateManager.rateManagerAddress
 * and RateManager.rateManagerId fields — we extend P2pVault to include those).
 */

import type { DailySnapshotRow, VaultDetailResponse } from "@/app/api/p2p/vaults/[id]/route";
import type { P2pVault } from "@/app/api/p2p/vaults/route";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { usePeerClient } from "@/lib/peer/client";
import { PEER_ENABLED } from "@/lib/peer/config";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { useAccount } from "wagmi";

// ─── types ────────────────────────────────────────────────────────────────────

type P2pVaultFull = P2pVault & {
  rateManagerId: string;
  rateManagerAddress: string | null;
};

interface LiveDeposit {
  depositId: string;
  depositBigintId: bigint;
  availableLiquidity: string;
  acceptingIntents: boolean;
}

type ChartMetric = "volume" | "tvl" | "fees" | "pnl";

// ─── formatters ───────────────────────────────────────────────────────────────

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(2)}%`);

function fmtDay(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── hooks ────────────────────────────────────────────────────────────────────

function useVaultList() {
  return useQuery<{ vaults: P2pVaultFull[] }>({
    queryKey: ["p2p", "vaults"],
    queryFn: async () => {
      const res = await fetch("/api/p2p/vaults");
      if (!res.ok) throw new Error(`vaults ${res.status}`);
      return res.json();
    },
    staleTime: 120_000,
  });
}

function useVaultDetail(id: string) {
  return useQuery<VaultDetailResponse>({
    queryKey: ["p2p", "vault-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/p2p/vaults/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`vault detail ${res.status}`);
      return res.json();
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

function useLiveDeposits(address: string | undefined) {
  const client = usePeerClient();
  return useQuery<LiveDeposit[]>({
    queryKey: ["peer", "account-deposits", address ?? "none"],
    queryFn: async (): Promise<LiveDeposit[]> => {
      if (!client || !address) return [];
      const views = await client.getAccountDeposits(address as `0x${string}`);
      return views.map((v) => ({
        depositId: v.depositId.toString(),
        depositBigintId: v.depositId,
        availableLiquidity: v.availableLiquidity.toString(),
        acceptingIntents: v.deposit.acceptingIntents,
      }));
    },
    enabled: !!client && !!address,
    staleTime: 30_000,
  });
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  green,
}: {
  label: string;
  value: string;
  sub?: string;
  green?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 20px",
        flex: 1,
        minWidth: 130,
      }}
    >
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="price"
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: green ? "var(--yes)" : "var(--ink)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── DailyChart ───────────────────────────────────────────────────────────────

const CHART_METRICS: { id: ChartMetric; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "tvl", label: "TVL" },
  { id: "fees", label: "Fees" },
  { id: "pnl", label: "PNL" },
];

function metricValue(row: DailySnapshotRow, m: ChartMetric): number {
  switch (m) {
    case "volume":
      return row.dailyVolume;
    case "tvl":
      return row.tvl;
    case "fees":
      return row.dailyFees;
    case "pnl":
      return row.dailyPnlUsd;
  }
}

function DailyChart({ snapshots }: { snapshots: DailySnapshotRow[] }) {
  const [metric, setMetric] = useState<ChartMetric>("volume");
  const [hovered, setHovered] = useState<number | null>(null);

  // Show last 30 days
  const rows = snapshots.slice(-30);
  const values = rows.map((r) => metricValue(r, metric));
  const maxVal = Math.max(...values.map(Math.abs), 0.01);
  const CHART_H = 120;
  const BAR_GAP = 3;
  const n = rows.length;

  if (n === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--line-2)",
          borderRadius: 12,
          padding: "32px 16px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--muted-2)",
        }}
      >
        No daily data yet.
      </div>
    );
  }

  const barW = `calc((100% - ${(n - 1) * BAR_GAP}px) / ${n})`;

  return (
    <div>
      {/* metric toggles */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {CHART_METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetric(m.id)}
            className={cn("rtab", metric === m.id && "on")}
            style={{ padding: "6px 12px", fontSize: 11.5 }}
          >
            {m.label}
          </button>
        ))}
        {hovered !== null && rows[hovered] && (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--f-tech)",
              fontSize: 11.5,
              color: "var(--ink-2)",
              alignSelf: "center",
            }}
          >
            {fmtDay(rows[hovered].dayTimestamp)} · {usd(metricValue(rows[hovered], metric))}
          </span>
        )}
      </div>

      {/* SVG bar chart */}
      <div
        style={{ position: "relative", height: CHART_H + 22, overflow: "hidden" }}
        onMouseLeave={() => setHovered(null)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: BAR_GAP,
            height: CHART_H,
          }}
        >
          {rows.map((row, i) => {
            const val = metricValue(row, metric);
            const isNeg = val < 0;
            const h = Math.max(2, (Math.abs(val) / maxVal) * CHART_H * 0.9);
            const color = isNeg ? "var(--no)" : metric === "pnl" ? "var(--yes)" : "var(--brand)";
            const alpha = hovered === null || hovered === i ? 1 : 0.38;

            return (
              <div
                key={row.dayTimestamp}
                title={`${fmtDay(row.dayTimestamp)}: ${usd(val)}`}
                onMouseEnter={() => setHovered(i)}
                style={{
                  width: barW,
                  flexShrink: 0,
                  height: h,
                  background: color,
                  borderRadius: "4px 4px 0 0",
                  opacity: alpha,
                  transition: "opacity .12s",
                  cursor: "default",
                }}
              />
            );
          })}
        </div>
        {/* x-axis: show every ~7th label */}
        <div
          style={{
            display: "flex",
            gap: BAR_GAP,
            paddingTop: 5,
            height: 18,
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.dayTimestamp}
              style={{
                width: barW,
                flexShrink: 0,
                fontFamily: "var(--f-tech)",
                fontSize: 9,
                color: "var(--muted-2)",
                textAlign: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {(i === 0 || i % 7 === 0 || i === rows.length - 1) && fmtDay(row.dayTimestamp)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RatesTable ───────────────────────────────────────────────────────────────

function RatesTable({ rates }: { rates: VaultDetailResponse["rates"] }) {
  if (rates.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted-2)", margin: 0 }}>
        No rate configuration published for this vault yet.
      </p>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: "8px 14px",
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
        }}
      >
        <span>Currency</span>
        <span>Platform</span>
        <span style={{ textAlign: "right" }}>Vault floor rate</span>
      </div>
      {rates.map((r) => (
        <div
          key={`${r.paymentMethod}:${r.currency}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            padding: "10px 14px",
            fontSize: 13,
            borderBottom: "1px solid var(--line)",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{r.currency || "—"}</span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{r.paymentMethod || "—"}</span>
          <span
            className="price"
            style={{ fontFamily: "var(--f-tech)", textAlign: "right", fontSize: 12.5 }}
          >
            {r.vaultRate != null
              ? r.vaultRate.toFixed(6)
              : r.minRate != null
                ? r.minRate.toFixed(6)
                : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── DelegateModal ────────────────────────────────────────────────────────────

function DelegateModal({
  vault,
  onClose,
}: {
  vault: P2pVaultFull;
  onClose: () => void;
}) {
  const { address } = useAccount();
  const client = usePeerClient();
  const depositsQ = useLiveDeposits(address);
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [btnState, setBtnState] = useState<"idle" | "pending" | "done">("idle");

  const deposits = depositsQ.data ?? [];
  const activeDeposits = deposits.filter((d) => d.acceptingIntents);

  async function handleDelegate() {
    if (!client || !address || !selectedDepositId) return;
    const deposit = deposits.find((d) => d.depositId === selectedDepositId);
    if (!deposit) return;

    if (!vault.rateManagerAddress) {
      toast.error({
        title: "Vault not eligible",
        description: "This vault has no onchain rate manager address registered.",
      });
      return;
    }

    setBtnState("pending");
    try {
      // EscrowV2 v2 route: assign the vault rate manager to the deposit directly
      const hash = await client.setRateManager({
        depositId: deposit.depositBigintId,
        rateManagerAddress: vault.rateManagerAddress as `0x${string}`,
        rateManagerId: vault.rateManagerId as `0x${string}`,
      });

      setBtnState("done");
      toast.success({
        title: "Delegation set",
        description: `Deposit ${deposit.depositId.slice(0, 10)}… will now use ${vault.name} for rate management. Tx: ${hash.slice(0, 10)}…`,
        ttlMs: 8000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error({ title: "Delegation failed", description: msg.slice(0, 200) });
      setBtnState("idle");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0,0,0,0.38)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: "24px 22px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Delegate to {vault.name}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              The vault will manage rates for your deposit. Vault fee:{" "}
              <strong>{vault.feePct.toFixed(2)}%</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "var(--muted-2)",
              lineHeight: 1,
              padding: "0 0 0 8px",
            }}
          >
            ×
          </button>
        </div>

        {/* not connected */}
        {!address && (
          <div
            style={{
              border: "1px dashed var(--line-2)",
              borderRadius: 12,
              padding: "24px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ink)" }}>
              Connect your wallet to delegate a deposit.
            </p>
          </div>
        )}

        {/* loading */}
        {address && depositsQ.isLoading && (
          <p style={{ fontSize: 13, color: "var(--muted-2)", textAlign: "center", padding: 16 }}>
            Loading your deposits…
          </p>
        )}

        {/* no active deposits */}
        {address && !depositsQ.isLoading && activeDeposits.length === 0 && (
          <div
            style={{
              border: "1px dashed var(--line-2)",
              borderRadius: 12,
              padding: "22px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>
              No active deposits found
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
              You need an active USDC deposit before you can delegate rate management to a vault.
            </p>
            <Link
              href={`/cash?tab=sell&vault=${vault.rateManagerId}`}
              className="btn btn-primary btn-sm"
              onClick={onClose}
            >
              Create deposit
            </Link>
          </div>
        )}

        {/* deposit list */}
        {address && !depositsQ.isLoading && activeDeposits.length > 0 && (
          <>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
                marginBottom: 10,
              }}
            >
              Select deposit to delegate
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {activeDeposits.map((d) => {
                const usdcAvail = (Number(d.availableLiquidity) / 1e6).toFixed(2);
                const isSelected = selectedDepositId === d.depositId;
                return (
                  <button
                    key={d.depositId}
                    type="button"
                    onClick={() => setSelectedDepositId(d.depositId)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      border: `1.5px solid ${isSelected ? "var(--brand)" : "var(--line)"}`,
                      borderRadius: 12,
                      background: isSelected ? "var(--bg-tint)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                        {usdcAvail} USDC available
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--f-tech)",
                          fontSize: 10,
                          color: "var(--muted-2)",
                          marginTop: 2,
                        }}
                      >
                        {d.depositId.slice(0, 12)}…
                      </div>
                    </div>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "var(--brand)" : "var(--line-2)"}`,
                        background: isSelected ? "var(--brand)" : "transparent",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {btnState === "done" ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 13.5,
                  color: "var(--yes)",
                  fontWeight: 600,
                  padding: "12px 0",
                }}
              >
                Delegation set successfully.
              </div>
            ) : (
              <button
                type="button"
                className="cta"
                onClick={handleDelegate}
                disabled={!selectedDepositId || btnState === "pending" || !vault.rateManagerAddress}
              >
                {btnState === "pending" ? "Delegating…" : `Delegate to ${vault.name}`}
              </button>
            )}

            {!vault.rateManagerAddress && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11.5,
                  color: "var(--no)",
                  textAlign: "center",
                }}
              >
                This vault has not registered an onchain rate manager address.
              </p>
            )}
          </>
        )}

        <p
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--muted-2)",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Delegation is set onchain. You can clear it at any time with clearRateManager on your
          deposit. The transaction signs from your connected wallet on Base.
        </p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const vaultListQ = useVaultList();
  const detailQ = useVaultDetail(id);
  const [showDelegate, setShowDelegate] = useState(false);

  const vault = vaultListQ.data?.vaults.find((v) => v.id === id);
  const detail = detailQ.data;

  if (!PEER_ENABLED) {
    return (
      <div
        className="ds4"
        style={{ background: "var(--bg)", minHeight: "100vh", padding: "80px 24px" }}
      >
        <p style={{ textAlign: "center", color: "var(--muted-2)" }}>
          P2P vaults are not enabled in this environment.
        </p>
      </div>
    );
  }

  const isLoading = vaultListQ.isLoading || detailQ.isLoading;
  const snapshots = detail?.snapshots ?? [];
  const rates = detail?.rates ?? [];

  // 7d APR from API (already computed server-side with correct 6dp/100 math)
  const apr7d = detail?.apr7d ?? null;

  // Lifetime stats from vault list
  const lifetimeVolume = vault?.volumeUsdc ?? 0;
  const lifetimePnl = vault?.pnlUsd ?? 0;
  const delegatedUsdc = vault?.delegatedUsdc ?? 0;
  const orders = vault?.orders ?? 0;

  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* back nav */}
      <div className="wrap" style={{ paddingTop: 22, paddingBottom: 0 }}>
        <Link
          href="/earn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--muted)",
            fontFamily: "var(--f-tech)",
            letterSpacing: ".06em",
          }}
        >
          ← Earn
        </Link>
      </div>

      <div className="wrap" style={{ paddingTop: 18, paddingBottom: 60 }}>
        {isLoading && !vault && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted-2)" }}>
            Loading vault…
          </div>
        )}

        {!isLoading && !vault && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted-2)" }}>
            Vault not found.{" "}
            <Link href="/earn" style={{ color: "var(--brand)" }}>
              Back to Earn
            </Link>
          </div>
        )}

        {vault && (
          <>
            {/* header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 24,
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                  {vault.name}
                </h1>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 11,
                      letterSpacing: ".1em",
                      color: "var(--muted-2)",
                      textTransform: "uppercase",
                    }}
                  >
                    Fee: {vault.feePct.toFixed(2)}%
                  </span>
                  {vault.uri && (
                    <a
                      href={vault.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 11,
                        color: "var(--brand)",
                        letterSpacing: ".06em",
                      }}
                    >
                      Manager info →
                    </a>
                  )}
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 11,
                      color: "var(--muted-2)",
                      letterSpacing: ".06em",
                    }}
                  >
                    {orders.toLocaleString()} orders filled
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowDelegate(true)}
              >
                Delegate deposits
              </button>
            </div>

            {/* stat cards */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <StatCard
                label="7d APR (realized)"
                value={apr7d != null ? pct(apr7d) : "—"}
                sub="PNL / avg TVL × 52"
                green={apr7d != null && apr7d > 0}
              />
              <StatCard
                label="Delegated"
                value={delegatedUsdc > 0 ? usd(delegatedUsdc) : "—"}
                sub="USDC currently delegated"
              />
              <StatCard
                label="Lifetime volume"
                value={lifetimeVolume > 0 ? usd(lifetimeVolume) : "—"}
              />
              <StatCard
                label="Lifetime PNL"
                value={
                  lifetimePnl !== 0 ? `${lifetimePnl >= 0 ? "+" : ""}${usd(lifetimePnl)}` : "—"
                }
                green={lifetimePnl > 0}
              />
            </div>

            {/* daily chart */}
            <section className="card" style={{ padding: 22, marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  marginBottom: 14,
                }}
              >
                Daily activity · last 30 days
              </div>
              {detailQ.isLoading ? (
                <div style={{ fontSize: 13, color: "var(--muted-2)", padding: "24px 0" }}>
                  Loading chart…
                </div>
              ) : (
                <DailyChart snapshots={snapshots} />
              )}
            </section>

            {/* rates table */}
            <section className="card" style={{ padding: 22, marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  marginBottom: 14,
                }}
              >
                Vault floor rates
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
                The vault manager sets a minimum conversion rate per platform and currency. Deposits
                delegated here will not fill below these floors.
              </p>
              {detailQ.isLoading ? (
                <div style={{ fontSize: 13, color: "var(--muted-2)" }}>Loading rates…</div>
              ) : (
                <RatesTable rates={rates} />
              )}
            </section>

            {/* delegation info */}
            <section className="card" style={{ padding: 22 }}>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  marginBottom: 10,
                }}
              >
                How delegation works
              </div>
              <p
                style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6 }}
              >
                Delegating an existing deposit to this vault assigns the vault's rate engine to
                manage conversion rates on your behalf. Your USDC stays in escrow and you keep your
                payment accounts. The vault only controls the rates it quotes.
              </p>
              <p
                style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}
              >
                Delegation is set onchain via EscrowV2 setRateManager and is reversible at any time.
                The vault fee ({vault.feePct.toFixed(2)}%) is deducted from the spread earned.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDelegate(true)}
              >
                Delegate an existing deposit
              </button>
            </section>
          </>
        )}
      </div>

      {/* delegate modal */}
      {showDelegate && vault && (
        <DelegateModal vault={vault} onClose={() => setShowDelegate(false)} />
      )}
    </div>
  );
}

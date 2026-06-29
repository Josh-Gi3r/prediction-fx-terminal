"use client";

/**
 * components/account/ActivityTab.tsx
 *
 * Unified activity history from real sources:
 *   1. App action log (localStorage, via logAction calls from swap/bridge/send success)
 *   2. PM bet positions (usePositions + useDeriveCreds — same pattern as PmBetsSection)
 *   3. VL batches (getVlBatches from lib/desks/vlStore)
 *   4. P2P intents + deposits (lib/peer/intentStore)
 *
 * Rendered newest-first, grouped by type, with explorer links per chain.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { type ActivityEntry, getActivityLog } from "@/lib/account/activityLog";
import { type StoredVlBatch, getVlBatches } from "@/lib/desks/vlStore";
import { listPeerDeposits, listPeerIntents } from "@/lib/peer/intentStore";
import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { usePositions } from "@/lib/polymarket/usePositions";
import { useEffect, useState } from "react";

// ─── Explorer links ───────────────────────────────────────────────────────────

function explorerTxUrl(hash: string, chainId: number): string {
  switch (chainId) {
    case 137:
      return `https://polygonscan.com/tx/${hash}`;
    case 8453:
      return `https://basescan.org/tx/${hash}`;
    default:
      return `https://etherscan.io/tx/${hash}`;
  }
}

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  swap: "Swap",
  bridge: "Bridge",
  send: "Send",
  bet: "Bet",
  p2p_buy: "P2P Buy",
  p2p_sell: "P2P Sell",
  earn_deposit: "Earn",
  earn_withdraw: "Withdraw",
};

const TYPE_COLOR: Record<string, string> = {
  swap: "var(--brand)",
  bridge: "#8247e5",
  send: "var(--muted)",
  bet: "#f59e0b",
  p2p_buy: "var(--yes)",
  p2p_sell: "var(--no)",
  earn_deposit: "var(--yes)",
  earn_withdraw: "var(--muted)",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: ".08em",
        textTransform: "uppercase" as const,
        color: TYPE_COLOR[type] ?? "var(--muted)",
        background: `${TYPE_COLOR[type] ?? "var(--muted)"}18`,
        borderRadius: 6,
        padding: "3px 7px",
        flexShrink: 0,
      }}
    >
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        border: "1px dashed var(--line-2)",
        borderRadius: 13,
        padding: "18px",
        textAlign: "center",
        color: "var(--muted-2)",
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pf-card">
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            {title}
          </div>
        </div>
        {right && <span className="right">{right}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ActivityTabProps {
  address: `0x${string}`;
}

export function ActivityTab({ address }: ActivityTabProps) {
  const [actionLog, setActionLog] = useState<ActivityEntry[]>([]);
  const [vlBatches, setVlBatches] = useState<StoredVlBatch[]>([]);
  const [peerIntents, setPeerIntents] = useState<ReturnType<typeof listPeerIntents>>([]);
  const [peerDeposits, setPeerDeposits] = useState<ReturnType<typeof listPeerDeposits>>([]);

  useEffect(() => {
    setActionLog(getActivityLog(address));
    setVlBatches(getVlBatches(address));
    setPeerIntents(listPeerIntents(address));
    setPeerDeposits(listPeerDeposits(address));
  }, [address]);

  // PM positions
  const { creds, derive, pending: credsPending, error: credsError, ready } = useDeriveCreds();
  const { positions, isLoading: posLoading } = usePositions(creds);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* App action log */}
      <SectionCard title="Swaps and actions" right="from this browser">
        {actionLog.length === 0 ? (
          <EmptyState label="No recorded actions yet. Swaps, bridges, and sends appear here after they complete." />
        ) : (
          <div className="ptbl">
            <div className="hd" style={{ gridTemplateColumns: "80px 1fr 1fr auto" }}>
              <div>Type</div>
              <div>Amount</div>
              <div>Time</div>
              <div />
            </div>
            {actionLog.map((entry) => (
              <div
                key={entry.id}
                className="rw"
                style={{ gridTemplateColumns: "80px 1fr 1fr auto" }}
              >
                <TypeBadge type={entry.type} />
                <div>
                  <div style={{ fontFamily: "var(--f-tech)", fontSize: 13, fontWeight: 700 }}>
                    {entry.amount} {entry.token}
                    {entry.toToken && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                        {" "}
                        to {entry.toAmount} {entry.toToken}
                      </span>
                    )}
                  </div>
                  {entry.label && (
                    <div style={{ fontSize: 11, color: "var(--muted-2)" }}>{entry.label}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", alignSelf: "center" }}>
                  {new Date(entry.timestamp).toLocaleDateString()}{" "}
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div style={{ alignSelf: "center" }}>
                  {entry.txHash && (
                    <a
                      href={explorerTxUrl(entry.txHash, entry.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 10,
                        color: "var(--brand)",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      Tx
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path
                          d="M2 1h7v7M9 1 1 9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* PM bets */}
      <SectionCard title="Prediction market bets" right="Polymarket positions on Polygon">
        {!ready ? null : !creds ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
              Sign once to load your Polymarket positions. Free and deterministic.
            </p>
            {credsError && (
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--no)" }}>{credsError}</p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => derive().catch(() => {})}
              disabled={credsPending}
              style={{ opacity: credsPending ? 0.65 : 1, fontSize: 13 }}
            >
              {credsPending ? "Signing..." : "Load bets"}
            </button>
          </div>
        ) : posLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <EmptyState label="No open Polymarket positions. Place a bet on the World Cup surface." />
        ) : (
          <div className="ptbl">
            <div className="hd" style={{ gridTemplateColumns: "3fr 70px 80px 80px" }}>
              <div>Market</div>
              <div className="r">Side</div>
              <div className="r">Shares</div>
              <div className="r">Current</div>
            </div>
            {positions.map((p) => (
              <div
                key={`${p.conditionId}-${p.outcome}`}
                className="rw"
                style={{ gridTemplateColumns: "3fr 70px 80px 80px" }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.title}
                </div>
                <span
                  className="amt"
                  style={{ color: p.outcome === "YES" ? "var(--yes)" : "var(--no)" }}
                >
                  {p.outcome}
                </span>
                <span className="amt">{p.size.toFixed(1)}</span>
                <span
                  className="amt"
                  style={{
                    color:
                      p.currentPrice != null && p.avgPrice != null
                        ? p.currentPrice > p.avgPrice
                          ? "var(--yes)"
                          : "var(--no)"
                        : "var(--muted-2)",
                  }}
                >
                  {p.currentPrice != null ? `${(p.currentPrice * 100).toFixed(1)}c` : "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* VL batches */}
      <SectionCard title="Virtual liquidity batches" right="maker orders">
        {vlBatches.length === 0 ? (
          <EmptyState label="No active VL batches. Post one from the Earn tab." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vlBatches.map((b) => (
              <div
                key={b.vlBatchId}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--f-tech)", fontWeight: 700, fontSize: 12 }}>
                    {b.vlBatchId.slice(0, 14)}...
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {b.amount} {b.budgetSymbol} · {b.legs.length} legs
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 9,
                    fontWeight: 800,
                    color: "var(--yes)",
                    background: "var(--yes-soft)",
                    borderRadius: 6,
                    padding: "3px 7px",
                    letterSpacing: ".06em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* P2P activity */}
      <SectionCard title="P2P cash activity" right="zkP2P intents">
        {peerIntents.length === 0 && peerDeposits.length === 0 ? (
          <EmptyState label="No P2P history yet. Use the Cash tab to buy or sell with fiat." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {peerDeposits.map((d) => (
              <div
                key={d.depositId}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--f-tech)", fontWeight: 700, fontSize: 12 }}>
                    Deposit · {d.usdcAmount} USDC
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {d.platforms.join(", ")} · {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 9,
                    fontWeight: 800,
                    color: d.status === "active" ? "var(--yes)" : "var(--muted-2)",
                    background: d.status === "active" ? "var(--yes-soft)" : "var(--bg-soft)",
                    borderRadius: 6,
                    padding: "3px 7px",
                    letterSpacing: ".06em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {d.status}
                </span>
              </div>
            ))}
            {peerIntents.map((intent) => (
              <div
                key={intent.intentHash}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--f-tech)", fontWeight: 700, fontSize: 12 }}>
                    {intent.side === "buy" ? "Buy" : "Sell"} {intent.usdcAmount} USDC
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {intent.platform} · {intent.fiatAmount} {intent.fiatCurrency} ·{" "}
                    {new Date(intent.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 9,
                    fontWeight: 800,
                    color: ["quoted", "signaled", "paid", "proving"].includes(intent.status)
                      ? "var(--brand)"
                      : intent.status === "fulfilled" || intent.status === "bridged"
                        ? "var(--yes)"
                        : "var(--muted-2)",
                    background: ["quoted", "signaled", "paid", "proving"].includes(intent.status)
                      ? "var(--bg-tint)"
                      : intent.status === "fulfilled" || intent.status === "bridged"
                        ? "var(--yes-soft)"
                        : "var(--bg-soft)",
                    borderRadius: 6,
                    padding: "3px 7px",
                    letterSpacing: ".06em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {intent.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

import type React from "react";

"use client";

import { FundWalletModal } from "@/components/wc/FundWalletModal";
import { useAaveReserves } from "@/lib/desks/aaveHooks";
import { useConfig, useTokens } from "@/lib/desks/hooks";
import { type StoredVlBatch, getVlBatches } from "@/lib/desks/vlStore";
import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { usePositions } from "@/lib/polymarket/usePositions";
import {
  CHAIN_CONFIGS,
  type ChainBalances,
  type ChainConfig,
  type TokenBalance,
  useMultiChainBalances,
} from "@/lib/portfolio/chains";
import { fmtToken, fmtUsd, fromRaw } from "@/lib/fx-provider/core/format";
import { FX_VAULT_ABI, type FxToken } from "@/lib/fx-provider/core/types";
import { openExternal } from "@/lib/telegram/openExternal";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { Icon } from "../Icon";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtNative(human: number, symbol: string): string {
  if (human === 0) return `0 ${symbol}`;
  if (human < 0.0001) return `<0.0001 ${symbol}`;
  return `${human.toFixed(4)} ${symbol}`;
}

// ── My Bets section (mobile-optimised, same hooks as PmBetsSection) ────────────

function MyBetsSection() {
  const { creds, derive, pending: credsPending, error: credsError, ready } = useDeriveCreds();
  const { positions, isLoading } = usePositions(creds);

  if (!ready) return null;

  if (!creds) {
    return (
      <>
        <div className="sec-head onlight">
          <h2>My bets</h2>
          <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
            Polymarket
          </span>
        </div>
        <div style={{ margin: "0 18px" }}>
          <div
            style={{
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "18px 16px",
              textAlign: "center",
            }}
          >
            <p
              style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}
            >
              One wallet signature loads your Polymarket positions. Free and deterministic. No funds
              moved.
            </p>
            {credsError && (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--no)" }}>{credsError}</p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => derive().catch(() => {})}
              disabled={credsPending}
              style={{ opacity: credsPending ? 0.65 : 1 }}
            >
              {credsPending ? "Signing..." : "Load my bets"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sec-head onlight">
        <h2>My bets</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
          {isLoading
            ? "loading"
            : `${positions.length} position${positions.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div
          style={{
            margin: "0 18px",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "20px 15px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 48,
                borderRadius: 10,
                background: "var(--bg-tint)",
              }}
            />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div
          style={{
            margin: "0 18px",
            border: "1px dashed var(--line-2)",
            borderRadius: 14,
            padding: "24px 18px",
            textAlign: "center",
            color: "var(--muted-2)",
            fontSize: 13,
          }}
        >
          No open positions. Place a bet on the World Cup tab.
        </div>
      ) : (
        <div className="listwrap">
          {positions.map((p) => {
            const isYes = p.outcome === "YES" || p.outcome === "Yes";
            return (
              <div className="pfrow" key={`${p.conditionId}-${p.outcome}`}>
                <span
                  className="tk"
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12.5,
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      overflow: "hidden",
                    }}
                  >
                    {p.title}
                  </span>
                  {p.resolved && (
                    <span
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 9,
                        color: p.winner === p.outcome ? "var(--yes)" : "var(--no)",
                        textTransform: "uppercase" as const,
                        letterSpacing: ".06em",
                      }}
                    >
                      {p.winner === p.outcome ? "Won" : "Resolved"}
                    </span>
                  )}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="amt"
                    style={{ color: isYes ? "var(--yes)" : "var(--no)", fontSize: 13 }}
                  >
                    {p.outcome}
                  </span>
                  <span
                    style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "var(--muted-2)" }}
                  >
                    {p.size.toFixed(1)} shares
                  </span>
                  {p.currentPrice != null && (
                    <span
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 11,
                        color:
                          p.avgPrice != null
                            ? p.currentPrice > p.avgPrice
                              ? "var(--yes)"
                              : p.currentPrice < p.avgPrice
                                ? "var(--no)"
                                : "var(--muted-2)"
                            : "var(--muted-2)",
                      }}
                    >
                      {(p.currentPrice * 100).toFixed(1)}c
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── VL batches section (real data from vlStore) ────────────────────────────────

function VlSection({
  batches,
  openView,
}: {
  batches: StoredVlBatch[];
  openView: (v: string) => void;
}) {
  return (
    <>
      <div className="sec-head onlight">
        <h2>Virtual Liquidity</h2>
        <span className="more" onClick={() => openView("earn")}>
          Post one <Icon name="chevron" size={13} />
        </span>
      </div>
      <div style={{ margin: "0 18px" }}>
        {batches.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--line-2)",
              borderRadius: 14,
              padding: "24px 18px",
              textAlign: "center",
              color: "var(--muted-2)",
              fontSize: 13,
            }}
          >
            No active VL batches. Post one from{" "}
            <span
              style={{ color: "var(--brand)", fontWeight: 700, cursor: "pointer" }}
              onClick={() => openView("earn")}
            >
              Earn
            </span>
            : pick corridors, set a spread, sign once.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {batches.map((b) => (
              <div className="vlb" key={b.vlBatchId}>
                <div className="top">
                  <div>
                    <div className="id">{b.vlBatchId.slice(0, 14)}...</div>
                    <div className="meta">
                      {b.amount} {b.budgetSymbol} · {b.legs.length} leg
                      {b.legs.length !== 1 ? "s" : ""}
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
                      flexShrink: 0,
                    }}
                  >
                    Active
                  </span>
                </div>
                {b.legs.length > 0 && (
                  <div className="legs">
                    {b.legs.map((leg, i) => (
                      <span className="leg" key={`${b.vlBatchId}-leg-${i}`}>
                        {leg.symbol}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Per-chain wallet card (mobile layout) ──────────────────────────────────────

function MobileChainCard({
  cfg,
  balances,
  onBridge,
  go,
}: {
  cfg: ChainConfig;
  balances: ChainBalances;
  onBridge: () => void;
  go: (tab: string) => void;
}) {
  const nonZeroTokens = balances.tokens.filter((tb) => tb.human > 0.000001);
  const hasGas = balances.nativeHuman > 0.000001;
  const isEmpty = !hasGas && nonZeroTokens.length === 0;
  const isLoading = balances.loading;

  const emptyCtaMap: Record<number, { text: string; btnLabel: string; run: () => void }> = {
    1: {
      text: "No stables on Ethereum — swap or deposit to start.",
      btnLabel: "Swap",
      run: () => go("swap"),
    },
    137: {
      text: "No USDC.e yet — Bridge from Ethereum first.",
      btnLabel: "Bridge now",
      run: onBridge,
    },
    8453: {
      text: "No USDC on Base yet — deposit to use P2P.",
      btnLabel: "P2P",
      run: () => go("p2p"),
    },
  };
  const emptyCta = emptyCtaMap[cfg.id];

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--bg-card, #fff)",
        marginBottom: 10,
      }}
    >
      {/* Chain header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "var(--f-tech)",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: cfg.color,
              background: `${cfg.color}18`,
              border: `1px solid ${cfg.color}40`,
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: cfg.color,
                flexShrink: 0,
              }}
            />
            {cfg.badge}
          </span>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {cfg.label}
          </span>
        </div>
        {balances.error && (
          <span style={{ fontFamily: "var(--f-tech)", fontSize: 9, color: "var(--no)" }}>
            RPC error
          </span>
        )}
      </div>

      {/* Gas line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 14px",
          borderBottom: "1px solid var(--line)",
          background: hasGas ? "transparent" : "rgba(240,67,106,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
            }}
          >
            Gas
          </span>
          {isLoading ? (
            <span
              style={{
                display: "inline-block",
                width: 60,
                height: 12,
                borderRadius: 4,
                background: "var(--bg-tint)",
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: hasGas ? "var(--ink)" : "var(--no)",
              }}
            >
              {fmtNative(balances.nativeHuman, cfg.nativeSymbol)}
            </span>
          )}
        </div>
        {!hasGas && !isLoading && (
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 9,
              color: "var(--no)",
              letterSpacing: "0.03em",
            }}
          >
            {cfg.gasNote}
          </span>
        )}
      </div>

      {/* Token rows or empty CTA */}
      {isLoading ? (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ height: 38, borderRadius: 8, background: "var(--bg-tint)" }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div
          style={{
            padding: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            color: "var(--muted-2)",
            fontSize: 12,
          }}
        >
          <span style={{ lineHeight: 1.5 }}>{emptyCta?.text}</span>
          {emptyCta && (
            <button
              type="button"
              onClick={emptyCta.run}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--brand)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {emptyCta.btnLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          {nonZeroTokens.map((tb) => (
            <MobileTokenRow key={tb.token.address} tb={tb} cfg={cfg} onBridge={onBridge} go={go} />
          ))}
        </div>
      )}
    </div>
  );
}

function MobileTokenRow({
  tb,
  cfg,
  onBridge,
  go,
}: {
  tb: TokenBalance;
  cfg: ChainConfig;
  onBridge: () => void;
  go: (tab: string) => void;
}) {
  const { token, human, usd } = tb;

  // Determine primary CTA
  const cta: { label: string; run: () => void } | null = (() => {
    if (cfg.id === 1 && (token.symbol === "USDC" || token.symbol === "USDT")) {
      return { label: "Swap", run: () => go("swap") };
    }
    if (cfg.id === 137) {
      return { label: "Bet", run: () => go("cup") };
    }
    if (cfg.id === 8453 && token.symbol === "USDC") {
      return { label: "P2P", run: () => go("p2p") };
    }
    return null;
  })();

  // Secondary CTA (Bridge, Ethereum stables only)
  const bridgeCta =
    cfg.id === 1 && (token.symbol === "USDC" || token.symbol === "USDT") ? onBridge : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 14px",
        borderTop: "1px solid var(--line)",
        gap: 8,
      }}
    >
      {/* Token identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--bg-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--f-tech)",
            fontSize: 7,
            fontWeight: 800,
            color: cfg.color,
            flexShrink: 0,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          {token.symbol.replace(".", "").slice(0, 4)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{token.symbol}</div>
          {usd !== null && human > 0 && (
            <div style={{ fontFamily: "var(--f-tech)", fontSize: 10, color: "var(--muted-2)" }}>
              {fmtUsd(usd)}
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 13,
          fontWeight: 700,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {fmtToken(human)}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        {cta && (
          <button
            type="button"
            onClick={cta.run}
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "4px 9px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {cta.label}
          </button>
        )}
        {bridgeCta && (
          <button
            type="button"
            onClick={bridgeCta}
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 700,
              background: "none",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 7,
              padding: "4px 9px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Bridge
          </button>
        )}
      </div>
    </div>
  );
}

// ── Receive panel (mobile, TG-safe explorer links) ────────────────────────────

function MobileReceivePanel({ address }: { address: `0x${string}` }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in some TG contexts — fall through silently
    }
  };

  return (
    <>
      <div className="sec-head onlight">
        <h2>Receive</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
          all chains
        </span>
      </div>
      <div style={{ margin: "0 18px" }}>
        <div
          style={{
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "14px 15px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Address row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink)",
                wordBreak: "break-all",
                flex: 1,
                minWidth: 0,
                lineHeight: 1.45,
              }}
            >
              {address}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                color: copied ? "var(--yes)" : "var(--brand)",
                background: "none",
                border: "1px solid var(--line)",
                borderRadius: 7,
                padding: "5px 12px",
                cursor: "pointer",
                flexShrink: 0,
                transition: "color 0.15s",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Note */}
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            Works on Ethereum, Polygon and Base. Always verify the network before sending.
          </p>

          {/* Explorer links (TG-safe via openExternal) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHAIN_CONFIGS.map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => openExternal(cfg.explorerAddr(address))}
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: cfg.color,
                  background: `${cfg.color}12`,
                  border: `1px solid ${cfg.color}30`,
                  borderRadius: 7,
                  padding: "3px 9px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  letterSpacing: "0.03em",
                }}
              >
                {cfg.label}
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path
                    d="M2 1h7v7M9 1 1 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Trading vault idle balances (mobile) ──────────────────────────────────────

function MobileIdleBalancesSection({
  positions,
  loading,
}: {
  positions: Array<{ token: FxToken; raw: bigint; human: number }>;
  loading: boolean;
}) {
  return (
    <>
      <div className="sec-head onlight">
        <h2>Trading vault</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
          idle balances
        </span>
      </div>
      <div style={{ margin: "0 18px" }}>
        {loading ? (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--bg-tint)" }} />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--line-2)",
              borderRadius: 14,
              padding: "20px 18px",
              textAlign: "center",
              color: "var(--muted-2)",
              fontSize: 13,
            }}
          >
            No idle vault balances. Deposit tokens to start trading.
          </div>
        ) : (
          <div className="listwrap">
            {positions.map((p) => (
              <div className="pfrow" key={p.token.address}>
                <span className="tk">
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 9,
                      fontWeight: 800,
                      color: "var(--brand)",
                      background: "var(--bg-tint)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "2px 5px",
                      flexShrink: 0,
                    }}
                  >
                    {p.token.symbol.slice(0, 4)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.token.symbol}</span>
                  {p.token.currency && (
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>
                      {p.token.currency}
                    </span>
                  )}
                </span>
                <span
                  className="amt"
                  style={{ fontFamily: "var(--f-tech)", fontSize: 13, fontWeight: 700 }}
                >
                  {fmtToken(p.human)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

interface PortfolioScreenProps {
  go: (tab: string) => void;
  openView: (v: string) => void;
}

export function PortfolioScreen({ go, openView }: PortfolioScreenProps) {
  const { reserves: aave } = useAaveReserves();
  const { address } = useAccount();
  const [tick, setTick] = useState(0);
  void tick;

  const isConnected = !!address;

  // Real multi-chain balances — same hook as desktop MultiChainWallet.
  const { chains, totalUsd, anyLoading } = useMultiChainBalances(
    address as `0x${string}` | undefined,
  );

  // Map chain ID -> ChainBalances for per-chain card rendering
  const balancesByChain = useMemo(() => {
    const m: Record<number, ChainBalances> = {};
    for (const cb of chains) {
      m[cb.chainId] = cb;
    }
    return m;
  }, [chains]);

  // Aggregate token balances across all chains for the KPI tiles
  const tokenBalances = chains.flatMap((c) => c.tokens.filter((t) => t.human > 0));
  const tokenUsd = tokenBalances.reduce((sum, t) => sum + (t.usd ?? 0), 0);

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  // VL batches from localStorage (same source as desktop VlBatchesSection)
  const [batches, setBatches] = useState<StoredVlBatch[]>([]);
  useEffect(() => {
    setBatches(getVlBatches(address));
  }, [address]);

  // Bridge modal state (inline, no page navigation)
  const [bridgeOpen, setBridgeOpen] = useState(false);

  // settlement vault idle balances — same logic as desktop PortfolioPage
  const { data: tokens } = useTokens();
  const { data: config } = useConfig();
  const vault = (config?.vault_address ??
    "0xC7d4Fd2638e6630C8C61329878676b88A8A24D43") as `0x${string}`;
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

  return (
    <div className="screen">
      <div className="appbar">
        <div className="ab-title">Portfolio</div>
        <span className="grow" />
        <button
          type="button"
          className="iconbtn"
          onClick={() => setTick((t) => t + 1)}
          aria-label="Refresh"
        >
          <Icon name="refresh" size={19} />
        </button>
      </div>

      {isConnected && shortAddr ? (
        <div className="walletbar">
          <div className="addr">
            <span className="dot" />
            <span className="a">{shortAddr}</span>
            <span className="net">· onchain</span>
          </div>
          <span className="ro">
            <Icon name="fx-provider" size={13} color="var(--accent-2)" />
            Read-only · non-custodial
          </span>
        </div>
      ) : (
        <div
          style={{
            margin: "0 18px 14px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line-2)",
            borderRadius: 14,
            padding: "13px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Connect a wallet to see live balances.
          </span>
        </div>
      )}

      {/* Summary tiles */}
      <div className="pftiles">
        <div className="pftile">
          <div className="l">Wallet</div>
          <div className="v">{!isConnected ? "$0.00" : anyLoading ? "..." : fmtUsd(tokenUsd)}</div>
          <div className="s">
            {!isConnected
              ? "not connected"
              : anyLoading
                ? "loading"
                : `${tokenBalances.length} token${tokenBalances.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="pftile">
          <div className="l">Total</div>
          <div className="v">{!isConnected ? "$0.00" : anyLoading ? "..." : fmtUsd(totalUsd)}</div>
          <div className="s">
            {!isConnected ? "preview" : anyLoading ? "loading" : "all chains"}
          </div>
        </div>
        <div className="pftile">
          <div className="l">VL batches</div>
          <div className="v">{batches.length}</div>
          <div className="s">{batches.length > 0 ? "active" : "none live"}</div>
        </div>
      </div>

      {/* Per-chain wallet cards — matches desktop MultiChainWallet structure */}
      <div className="sec-head onlight">
        <h2>Wallet</h2>
        {anyLoading && isConnected && (
          <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
            loading
          </span>
        )}
      </div>

      {!isConnected ? (
        <div
          style={{
            margin: "0 18px",
            border: "1px dashed var(--line-2)",
            borderRadius: 14,
            padding: "24px 18px",
            textAlign: "center",
            color: "var(--muted-2)",
            fontSize: 13,
          }}
        >
          Connect a wallet to view balances.
        </div>
      ) : (
        <div style={{ margin: "0 18px" }}>
          {CHAIN_CONFIGS.map((cfg) => {
            const cb = balancesByChain[cfg.id];
            if (!cb) return null;
            return (
              <MobileChainCard
                key={cfg.id}
                cfg={cfg}
                balances={cb}
                onBridge={() => setBridgeOpen(true)}
                go={go}
              />
            );
          })}
        </div>
      )}

      {/* Receive panel */}
      {isConnected && address && <MobileReceivePanel address={address as `0x${string}`} />}

      {/* Trading vault idle balances */}
      <MobileIdleBalancesSection positions={fxVault} loading={vaultLoading} />

      {/* Aave v3 supplies */}
      <div className="sec-head onlight">
        <h2>Aave v3 supplies</h2>
        <span style={{ fontFamily: "var(--f-tech)", fontSize: 11.5, color: "var(--muted-2)" }}>
          {isConnected ? "live APY" : "preview · connect for balances"}
        </span>
      </div>

      {!isConnected ? (
        <div
          style={{
            margin: "0 18px",
            border: "1px dashed var(--line-2)",
            borderRadius: 14,
            padding: "24px 18px",
            textAlign: "center",
            color: "var(--muted-2)",
            fontSize: 13,
          }}
        >
          Connect a wallet to see your Aave positions.
        </div>
      ) : (
        <div className="listwrap">
          {aave.length === 0 ? (
            <div
              style={{
                padding: "20px 18px",
                textAlign: "center",
                color: "var(--muted-2)",
                fontSize: 13,
              }}
            >
              No Aave v3 supply positions found for this address.
            </div>
          ) : (
            aave.slice(0, 6).map((res) => (
              <div className="pfrow" key={res.symbol}>
                <span className="tk">
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 9,
                      fontWeight: 800,
                      color: "var(--brand)",
                      background: "var(--bg-tint)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "2px 5px",
                    }}
                  >
                    {res.symbol.slice(0, 4)}
                  </span>
                  {res.symbol}
                </span>
                <span className="apy" style={{ marginRight: 12 }}>
                  {res.apyPct != null ? `${res.apyPct.toFixed(2)}%` : "-"}
                </span>
                <span className="amt">
                  <div className="usd">live APY</div>
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* VL batches */}
      <VlSection batches={batches} openView={openView} />

      {/* My Bets — Polymarket positions */}
      {isConnected && <MyBetsSection />}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          margin: "18px 18px 6px",
          color: "var(--muted)",
          fontSize: 12,
        }}
      >
        You&apos;re in control. FX Terminal only reads onchain state.
      </div>
      <div style={{ height: 8 }} />

      {/* Bridge modal — inline, TG-safe (no navigation) */}
      <FundWalletModal open={bridgeOpen} onClose={() => setBridgeOpen(false)} />
    </div>
  );
}

import type React from "react";

"use client";

import { type PendleMarket, usePendleMarkets } from "@/lib/desks/hooks";
import { PENDLE_CHAIN_ID, usdcHumanToRaw, usePendleBuy } from "@/lib/desks/pendleTrade";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "../ConnectButton";
import {
  BTN_PRI,
  BTN_PRI_DIS,
  EarnSection,
  RetryErrorRow,
  StatusBanner,
  WrongChainBanner,
} from "./shared";

// ─── PendlePanel ──────────────────────────────────────────────────────────────
export function PendlePanel() {
  const { data, isLoading } = usePendleMarkets();
  const markets = data?.markets ?? [];
  return (
    <EarnSection
      id="earn-pendle"
      title="Pendle PT · fixed yield, locked"
      subtitle="Lock in today's APY until maturity. PT trades at a discount; redeems 1:1 at expiry. Buy in-app: enter USDC, approve exact amount, receive PT in your wallet."
    >
      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
              key={i}
              style={{
                height: 80,
                borderRadius: 13,
                border: "1px solid var(--line)",
                background: "var(--bg-soft)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}
      {!isLoading && markets.length === 0 && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 13,
            padding: 12,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          No active stablecoin PT markets right now.
        </div>
      )}
      {markets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {markets.map((m) => (
            <PendleTile key={m.marketAddress} m={m} />
          ))}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted-2)" }}>
        Data: Pendle v2 · live every 5min · Ethereum mainnet · exact-amount approve only
      </div>
    </EarnSection>
  );
}

// ─── PendleTile — interactive in-app buy flow ─────────────────────────────────
function PendleTile({ m }: { m: PendleMarket }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const expiry = new Date(m.expiry);
  const daysToExpiry = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 86400000));
  const liqLabel =
    m.liquidityUsd >= 1e9
      ? `$${(m.liquidityUsd / 1e9).toFixed(1)}B`
      : m.liquidityUsd >= 1e6
        ? `$${(m.liquidityUsd / 1e6).toFixed(1)}M`
        : `$${(m.liquidityUsd / 1e3).toFixed(0)}K`;

  const [open, setOpen] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendle = usePendleBuy(address);

  // Auto-quote when amount changes (debounced 600ms) and panel is open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: m.marketAddress is stable per tile render
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = usdcAmount.trim();
    if (!trimmed || Number(trimmed) <= 0) return;
    debounceRef.current = setTimeout(() => {
      let raw: string;
      try {
        raw = usdcHumanToRaw(trimmed);
      } catch {
        return;
      }
      pendle.fetchQuote({
        marketAddress: m.marketAddress,
        ptAddress: m.ptAddress,
        amountInRaw: raw,
        slippage: 0.005,
      });
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdcAmount, open]);

  // Reset buy state when panel closes.
  const handleClose = useCallback(() => {
    setOpen(false);
    setUsdcAmount("");
    pendle.reset();
  }, [pendle]);

  const onChain = chainId === PENDLE_CHAIN_ID;
  const quoting = pendle.status === "quoting";
  const buying =
    pendle.status === "approving" || pendle.status === "buying" || pendle.status === "confirming";
  const canBuy =
    !!pendle.quote &&
    !pendle.isQuoteStale &&
    !buying &&
    pendle.status !== "success" &&
    pendle.status !== "unconfirmed";

  // Derived APY from live quote (more accurate than impliedApyPct from market list)
  const liveApy =
    pendle.quote && Number(usdcAmount) > 0
      ? (() => {
          const n = Number(usdcAmount);
          const ptOut = pendle.quote.amountOutHuman;
          if (ptOut <= n) return m.impliedApyPct;
          const ptPrice = n / ptOut;
          const ann = (1 / ptPrice - 1) * (365 / Math.max(1, daysToExpiry));
          return ann * 100;
        })()
      : m.impliedApyPct;

  return (
    <div
      style={{
        border: open ? "1.5px solid var(--brand-3)" : "1px solid var(--line)",
        background: open ? "#fff" : "var(--bg-soft)",
        borderRadius: 13,
        transition: ".14s",
      }}
    >
      {/* Tile header — always visible */}
      <button
        type="button"
        style={{
          padding: 14,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: 0,
          display: "block",
        }}
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            pendle.reset();
            setOpen(true);
          }
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              letterSpacing: ".04em",
              color: "var(--muted-2)",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.name}
          </span>
          <span
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 800,
              fontSize: 22,
              color: "var(--yes)",
              flexShrink: 0,
            }}
          >
            {liveApy.toFixed(2)}%
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 5,
          }}
        >
          <span>Fixed · {daysToExpiry}d to expiry</span>
          <span style={{ fontFamily: "var(--f-tech)", color: open ? "var(--brand)" : undefined }}>
            {liqLabel} liq · {open ? "close ✕" : "Buy PT ↓"}
          </span>
        </div>
      </button>

      {/* Buy panel — inline, slides open */}
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--line)",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Wallet not connected */}
          {!isConnected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Connect your wallet to buy PT.
              </div>
              <ConnectButton />
            </div>
          )}

          {/* Wrong chain */}
          {isConnected && !onChain && (
            <WrongChainBanner
              message="Pendle markets are on Ethereum mainnet."
              onSwitch={() => switchChain({ chainId: PENDLE_CHAIN_ID })}
              switchLabel="Switch chain"
            />
          )}

          {/* Amount input + quote */}
          {isConnected &&
            onChain &&
            pendle.status !== "success" &&
            pendle.status !== "unconfirmed" && (
              <>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--muted-2)",
                      marginBottom: 6,
                    }}
                  >
                    USDC to spend
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      background: "#fff",
                      padding: "9px 12px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--f-ui)",
                        fontSize: 13,
                        color: "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      USDC
                    </span>
                    <input
                      inputMode="decimal"
                      value={usdcAmount}
                      onChange={(e) =>
                        /^\d*\.?\d*$/.test(e.target.value) && setUsdcAmount(e.target.value)
                      }
                      placeholder="100"
                      disabled={buying}
                      style={{
                        flex: 1,
                        border: 0,
                        background: "none",
                        textAlign: "right",
                        fontFamily: "var(--f-display)",
                        fontWeight: 800,
                        fontSize: 22,
                        color: "var(--ink)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Quote display */}
                {(pendle.status === "quoting" || pendle.quote) && (
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--bg-soft)",
                      padding: "10px 13px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    {pendle.status === "quoting" && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted-2)",
                          fontFamily: "var(--f-tech)",
                        }}
                      >
                        Getting quote…
                      </div>
                    )}
                    {pendle.quote && pendle.status !== "quoting" && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                          }}
                        >
                          <span style={{ color: "var(--muted)" }}>You receive</span>
                          <span
                            style={{
                              fontFamily: "var(--f-tech)",
                              fontWeight: 700,
                              color: "var(--ink)",
                            }}
                          >
                            {pendle.quote.amountOutHuman.toFixed(4)} PT-{m.symbol ?? m.name}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: "var(--muted-2)" }}>Fixed APY locked</span>
                          <span
                            style={{
                              fontFamily: "var(--f-tech)",
                              fontWeight: 700,
                              color: "var(--yes)",
                            }}
                          >
                            {liveApy.toFixed(2)}%
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: "var(--muted-2)" }}>Expiry</span>
                          <span style={{ fontFamily: "var(--f-tech)", color: "var(--muted)" }}>
                            {expiry.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            ({daysToExpiry}d)
                          </span>
                        </div>
                        {Math.abs(pendle.quote.priceImpact) > 0.0005 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11.5,
                            }}
                          >
                            <span style={{ color: "var(--muted-2)" }}>Price impact</span>
                            <span
                              style={{
                                fontFamily: "var(--f-tech)",
                                color:
                                  Math.abs(pendle.quote.priceImpact) > 0.005
                                    ? "var(--no)"
                                    : "var(--muted)",
                              }}
                            >
                              {(pendle.quote.priceImpact * 100).toFixed(3)}%
                            </span>
                          </div>
                        )}
                        {pendle.isQuoteStale && (
                          <div style={{ fontSize: 11, color: "var(--no)" }}>
                            Quote expired. Type to refresh.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Buy / approve button */}
                <button
                  type="button"
                  disabled={!canBuy || !Number(usdcAmount)}
                  onClick={() => {
                    if (pendle.quote) {
                      pendle.execute(pendle.quote, m.ptAddress);
                    }
                  }}
                  style={{
                    ...(canBuy && Number(usdcAmount) ? BTN_PRI : BTN_PRI_DIS),
                  }}
                >
                  {pendle.status === "approving"
                    ? "Approve USDC in wallet…"
                    : pendle.status === "buying"
                      ? "Sign tx in wallet…"
                      : pendle.status === "confirming"
                        ? "Confirming onchain…"
                        : pendle.status === "quoting"
                          ? "Quoting…"
                          : !pendle.quote || pendle.isQuoteStale
                            ? "Enter amount to quote"
                            : "Buy PT"}
                </button>
              </>
            )}

          {/* Error state */}
          {pendle.status === "error" && pendle.error && (
            <RetryErrorRow message={pendle.error} onRetry={() => pendle.reset()} />
          )}

          {/* Success state */}
          {pendle.status === "success" && pendle.receipt && (
            <StatusBanner variant="success" style={{ padding: "11px 13px", fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>PT purchased</div>
              <div style={{ fontSize: 12 }}>
                Received {pendle.receipt.ptReceived} PT-{m.symbol ?? m.name}
              </div>
              <div style={{ fontSize: 11, marginTop: 3, color: "#0a7a53aa" }}>
                Fixed at {liveApy.toFixed(2)}% APY until{" "}
                {expiry.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <a
                href={`https://etherscan.io/tx/${pendle.receipt.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: "var(--brand)", marginTop: 4, display: "block" }}
              >
                View on Etherscan ↗
              </a>
            </StatusBanner>
          )}

          {/* Unconfirmed state */}
          {pendle.status === "unconfirmed" && (
            <StatusBanner variant="warning" style={{ padding: "9px 12px", fontSize: 12 }}>
              Transaction submitted but not confirmed within 90s. Check Etherscan for the outcome.
            </StatusBanner>
          )}

          {/* Secondary link to Pendle */}
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: "var(--muted-2)",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            View market on app.pendle.finance ↗
          </a>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * components/mobile/earn/PendleTile.tsx
 * Pendle PT buy — real on-chain flow (Ethereum mainnet).
 * Hook: usePendleBuy from lib/desks/pendleTrade.ts
 */

import { type PendleMarket, usePendleMarkets } from "@/lib/desks/hooks";
import { PENDLE_CHAIN_ID, usdcHumanToRaw, usePendleBuy } from "@/lib/desks/pendleTrade";
import { openExternal } from "@/lib/telegram/openExternal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { AmountInput, ChainBanner, ErrBanner, MobileConnectButton, OkBanner } from "./primitives";

const pendleDays = (expiry: string) =>
  Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000));

function PendleTile({ m }: { m: PendleMarket }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendle = usePendleBuy(address);

  const daysToExpiry = pendleDays(m.expiry);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable per tile
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

  const handleClose = useCallback(() => {
    setOpen(false);
    setUsdcAmount("");
    pendle.reset();
  }, [pendle]);

  const liqLabel =
    m.liquidityUsd >= 1e9
      ? `$${(m.liquidityUsd / 1e9).toFixed(1)}B`
      : m.liquidityUsd >= 1e6
        ? `$${(m.liquidityUsd / 1e6).toFixed(1)}M`
        : `$${(m.liquidityUsd / 1e3).toFixed(0)}K`;

  return (
    <div className={`tile-y-wrap${open ? " open" : ""}`}>
      <button
        type="button"
        className="tile-y-head"
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            pendle.reset();
            setOpen(true);
          }
        }}
      >
        <div className="th">
          <span className="nm">{m.symbol || m.name}</span>
          <span className="ap">{liveApy.toFixed(2)}%</span>
        </div>
        <div className="sub">
          <span>
            Fixed · {daysToExpiry}d · {liqLabel}
          </span>
          <span className="mono" style={{ color: open ? "var(--brand)" : undefined }}>
            {open ? "close ✕" : "Buy PT ↓"}
          </span>
        </div>
      </button>

      {open && (
        <div className="tile-y-panel">
          {!isConnected && (
            <div>
              <div className="subnote">Connect wallet to buy PT.</div>
              <MobileConnectButton />
            </div>
          )}

          {isConnected && !onChain && (
            <ChainBanner
              label="Pendle markets are on Ethereum mainnet."
              chainId={PENDLE_CHAIN_ID}
            />
          )}

          {isConnected &&
            onChain &&
            pendle.status !== "success" &&
            pendle.status !== "unconfirmed" && (
              <>
                <AmountInput
                  label="USDC to spend"
                  value={usdcAmount}
                  onChange={setUsdcAmount}
                  disabled={buying}
                  placeholder="100"
                />

                {(quoting || pendle.quote) && (
                  <div className="quote-box">
                    {quoting && <div className="subnote">Getting quote…</div>}
                    {pendle.quote && !quoting && (
                      <>
                        <div className="qrow">
                          <span>You receive</span>
                          <span className="mono">
                            {pendle.quote.amountOutHuman.toFixed(4)} PT-{m.symbol || m.name}
                          </span>
                        </div>
                        <div className="qrow">
                          <span>Fixed APY locked</span>
                          <span className="mono yes">{liveApy.toFixed(2)}%</span>
                        </div>
                        <div className="qrow">
                          <span>Expiry</span>
                          <span className="mono">
                            {new Date(m.expiry).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            ({daysToExpiry}d)
                          </span>
                        </div>
                        {Math.abs(pendle.quote.priceImpact) > 0.0005 && (
                          <div className="qrow">
                            <span>Price impact</span>
                            <span
                              className="mono"
                              style={{
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
                          <div className="subnote" style={{ color: "var(--no)" }}>
                            Quote expired. Type to refresh.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={!canBuy || !Number(usdcAmount)}
                  onClick={() => {
                    if (pendle.quote) pendle.execute(pendle.quote, m.ptAddress);
                  }}
                >
                  {pendle.status === "approving"
                    ? "Approve USDC…"
                    : pendle.status === "buying"
                      ? "Sign tx…"
                      : pendle.status === "confirming"
                        ? "Confirming…"
                        : quoting
                          ? "Quoting…"
                          : !pendle.quote || pendle.isQuoteStale
                            ? "Enter amount to quote"
                            : "Buy PT"}
                </button>
              </>
            )}

          {pendle.status === "error" && pendle.error && (
            <ErrBanner msg={pendle.error} onRetry={() => pendle.reset()} />
          )}

          {pendle.status === "success" && pendle.receipt && (
            <OkBanner>
              <strong>PT purchased</strong>
              <div style={{ fontSize: 12, marginTop: 3 }}>
                Received {pendle.receipt.ptReceived} PT-{m.symbol || m.name}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>
                Fixed at {liveApy.toFixed(2)}% APY until{" "}
                {new Date(m.expiry).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  openExternal(`https://etherscan.io/tx/${pendle.receipt?.txHash ?? ""}`)
                }
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
            </OkBanner>
          )}

          {pendle.status === "unconfirmed" && (
            <div className="warn-banner" style={{ display: "block" }}>
              Tx submitted but not confirmed within 90s. Check Etherscan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PendleSection() {
  const { data: pendle } = usePendleMarkets();
  return (
    <div className="emod">
      <div className="emod-h">
        <h3>Pendle PT · fixed yield</h3>
        <p>
          Lock today's APY until maturity. PT trades at a discount and redeems 1:1 at expiry. Enter
          USDC, approve exact amount, receive PT.
        </p>
      </div>
      <div className="ytiles" style={{ marginTop: 14 }}>
        {(pendle?.markets ?? []).map((mk) => (
          <PendleTile key={mk.marketAddress} m={mk} />
        ))}
        {!pendle && <div className="subnote">Loading live Pendle markets…</div>}
      </div>
    </div>
  );
}

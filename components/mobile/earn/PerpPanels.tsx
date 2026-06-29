"use client";

/**
 * components/mobile/earn/PerpPanels.tsx
 * HLP Deposit (Arbitrum/Hyperliquid) + GMX Deposit (Arbitrum).
 * Hooks: useHlpDeposit, useGmxDeposit from lib/desks/
 */

import {
  GMX_CHAIN_ID,
  gmxUsdcHumanToRaw,
  useGmxDeposit,
  validateGmxDepositAmount,
} from "@/lib/desks/gmxDeposit";
import {
  HLP_CHAIN_ID,
  hlpUsdcHumanToRaw,
  useHlpDeposit,
  validateHlpDepositAmount,
} from "@/lib/desks/hlpDeposit";
import { type PerpVaults, usePerpVaults } from "@/lib/desks/hooks";
import { openExternal } from "@/lib/telegram/openExternal";
import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  AmountInput,
  ChainBanner,
  ErrBanner,
  InfoNote,
  MobileConnectButton,
  OkBanner,
} from "./primitives";

/* ── HLP ──────────────────────────────────────────────────────────────────── */

function HlpPanel({ aprPct }: { aprPct: number | null }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState("");
  const hlp = useHlpDeposit(address);

  const onChain = chainId === HLP_CHAIN_ID;
  const amountNum = Number(usdcAmount) || 0;
  const amountErr = usdcAmount ? validateHlpDepositAmount(amountNum) : null;
  const busy =
    hlp.status === "bridging" ||
    hlp.status === "crediting" ||
    hlp.status === "delegating" ||
    hlp.status === "polling";
  const canDeposit = isConnected && onChain && amountNum > 0 && !amountErr && !busy;

  function handleClose() {
    setOpen(false);
    setUsdcAmount("");
    hlp.reset();
  }

  async function handleDeposit() {
    let rawBigint: bigint;
    try {
      rawBigint = hlpUsdcHumanToRaw(usdcAmount);
    } catch {
      return;
    }
    await hlp.execute({ amountRaw: rawBigint, amountHuman: amountNum });
  }

  const btnLabel = () => {
    switch (hlp.status) {
      case "bridging":
        return "Bridging USDC to Hyperliquid…";
      case "crediting":
        return "Waiting for HL credit…";
      case "delegating":
        return "Sign vault deposit…";
      case "polling":
        return "Confirming vault deposit…";
      default:
        return "Deposit to HLP";
    }
  };

  return (
    <div className={`perp-tile${open ? " open" : ""}`}>
      <button
        type="button"
        className="perp-tile-head"
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            hlp.reset();
            setOpen(true);
          }
        }}
      >
        <div className="eyebrow-sm">Hyperliquid HLP</div>
        <div className="ap" style={{ margin: "4px 0" }}>
          {aprPct != null ? `${aprPct.toFixed(2)}%` : "—"}
          <small style={{ fontWeight: 400, fontSize: 12 }}> APR · live</small>
        </div>
        <div className="subnote" style={{ color: open ? "var(--brand)" : undefined }}>
          {open ? "close ✕" : "Deposit ↓"}
        </div>
      </button>

      {open && (
        <div className="tile-y-panel">
          {!isConnected && (
            <div>
              <div className="subnote">Connect wallet to deposit.</div>
              <MobileConnectButton />
            </div>
          )}

          {isConnected && !onChain && (
            <ChainBanner label="HLP deposit goes through Arbitrum." chainId={HLP_CHAIN_ID} />
          )}

          {isConnected && onChain && hlp.status !== "success" && hlp.status !== "unconfirmed" && (
            <>
              <InfoNote>
                <strong>2-step:</strong> (1) USDC bridged Arbitrum → HL. (2) Sign vault deposit into
                HLP.
              </InfoNote>

              <AmountInput
                label="USDC to deposit (Arbitrum)"
                value={usdcAmount}
                onChange={setUsdcAmount}
                disabled={busy}
                placeholder="100"
                error={amountErr}
              />

              {busy && (
                <div className="status-note">
                  {hlp.status === "bridging" && "Step 1/2 · Bridging USDC to Hyperliquid…"}
                  {hlp.status === "crediting" && "Step 1/2 · Waiting for HL credit (up to 90s)…"}
                  {hlp.status === "delegating" && "Step 2/2 · Sign vault deposit in wallet…"}
                  {hlp.status === "polling" && "Step 2/2 · Confirming vault deposit…"}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={!canDeposit}
                onClick={handleDeposit}
              >
                {btnLabel()}
              </button>
            </>
          )}

          {hlp.status === "error" && hlp.error && (
            <ErrBanner msg={hlp.error} onRetry={() => hlp.reset()} />
          )}

          {hlp.status === "success" && hlp.receipt && (
            <OkBanner>
              <strong>HLP deposit confirmed</strong>
              <div style={{ fontSize: 12, marginTop: 3 }}>
                Deposited {hlp.receipt.hlUsdAmount.toFixed(2)} USDC into HLP
              </div>
              {hlp.receipt.vaultEquity && (
                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>
                  Vault equity: ${hlp.receipt.vaultEquity}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  openExternal(`https://arbiscan.io/tx/${hlp.receipt?.bridgeTxHash ?? ""}`)
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
                View bridge tx on Arbiscan
              </button>
            </OkBanner>
          )}

          {hlp.status === "unconfirmed" && (
            <div className="warn-banner" style={{ display: "block" }}>
              Bridge tx confirmed. Vault deposit not yet visible. Check your Hyperliquid account.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── GMX ──────────────────────────────────────────────────────────────────── */

function GmxPanel({ gmx }: { gmx: PerpVaults["gmx"] }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedMarket, setSelectedMarket] = useState<(typeof gmx)[number] | null>(null);
  const [usdcAmount, setUsdcAmount] = useState("");
  const [openPanel, setOpenPanel] = useState(false);
  const gmxDep = useGmxDeposit(address);

  const onChain = chainId === GMX_CHAIN_ID;
  const amountNum = Number(usdcAmount) || 0;
  const amountErr = usdcAmount ? validateGmxDepositAmount(amountNum) : null;
  const busy =
    gmxDep.status === "approving" || gmxDep.status === "depositing" || gmxDep.status === "awaiting";
  const canDeposit =
    isConnected && onChain && !!selectedMarket && amountNum > 0 && !amountErr && !busy;

  function handleClose() {
    setOpenPanel(false);
    setUsdcAmount("");
    setSelectedMarket(null);
    gmxDep.reset();
  }

  async function handleDeposit() {
    if (!selectedMarket) return;
    let rawBigint: bigint;
    try {
      rawBigint = gmxUsdcHumanToRaw(usdcAmount);
    } catch {
      return;
    }
    await gmxDep.execute({
      marketToken: selectedMarket.marketToken as `0x${string}`,
      amountRaw: rawBigint,
    });
  }

  const btnLabel = () => {
    switch (gmxDep.status) {
      case "approving":
        return "Approve USDC…";
      case "depositing":
        return "Sign deposit tx…";
      case "awaiting":
        return "Awaiting keeper execution…";
      default:
        return selectedMarket
          ? `Deposit into ${selectedMarket.name.split(" ")[0]} GM pool`
          : "Select a pool";
    }
  };

  if (gmx.length === 0) {
    return (
      <div className="perp-tile">
        <div className="eyebrow-sm">GMX v2 GM · Arbitrum</div>
        <div className="subnote" style={{ marginTop: 8 }}>
          No stable-paired GM pools right now.
        </div>
      </div>
    );
  }

  return (
    <div className={`perp-tile${openPanel ? " open" : ""}`}>
      <div className="eyebrow-sm">GMX v2 GM · Arbitrum</div>
      <div className="gm-list" style={{ marginTop: 8 }}>
        {gmx.map((p) => (
          <button
            key={p.marketToken}
            type="button"
            className={`gm-row${selectedMarket?.marketToken === p.marketToken && openPanel ? " on" : ""}`}
            onClick={() => {
              if (selectedMarket?.marketToken === p.marketToken && openPanel) {
                handleClose();
              } else {
                setSelectedMarket(p);
                gmxDep.reset();
                setUsdcAmount("");
                setOpenPanel(true);
              }
            }}
          >
            <span>{p.name}</span>
            <span className="v yes">{p.apyPct > 0 ? `${p.apyPct.toFixed(2)}%` : "—"}</span>
          </button>
        ))}
      </div>

      {openPanel && selectedMarket && (
        <div className="tile-y-panel" style={{ marginTop: 12 }}>
          {!isConnected && (
            <div>
              <div className="subnote">Connect wallet to deposit.</div>
              <MobileConnectButton />
            </div>
          )}

          {isConnected && !onChain && (
            <ChainBanner label="GMX pools are on Arbitrum." chainId={GMX_CHAIN_ID} />
          )}

          {isConnected &&
            onChain &&
            gmxDep.status !== "success" &&
            gmxDep.status !== "unconfirmed" && (
              <>
                <InfoNote>
                  Depositing USDC single-sided into <strong>{selectedMarket.name}</strong>. GMX
                  keepers execute within ~60s. Requires ~0.0003 ETH on Arbitrum for keeper fee.
                </InfoNote>

                <AmountInput
                  label="USDC to deposit (Arbitrum)"
                  value={usdcAmount}
                  onChange={setUsdcAmount}
                  disabled={busy}
                  placeholder="100"
                  error={amountErr}
                />

                {amountNum > 0 && !amountErr && (
                  <div className="quote-box">
                    GM tokens received at market-rate oracle execution by GMX keepers. No price
                    impact estimate before execution.
                  </div>
                )}

                {gmxDep.status === "awaiting" && (
                  <div className="status-note">
                    Deposit request confirmed. Keeper execution takes up to 90s; GM tokens will
                    appear in your wallet.
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={!canDeposit}
                  onClick={handleDeposit}
                >
                  {btnLabel()}
                </button>
              </>
            )}

          {gmxDep.status === "error" && gmxDep.error && (
            <ErrBanner msg={gmxDep.error} onRetry={() => gmxDep.reset()} />
          )}

          {gmxDep.status === "success" && gmxDep.receipt && (
            <OkBanner>
              <strong>GM pool deposit confirmed</strong>
              {gmxDep.receipt.gmReceived ? (
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  Received {gmxDep.receipt.gmReceived} GM tokens
                </div>
              ) : (
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  Deposit request submitted. GM tokens pending keeper execution.
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  openExternal(`https://arbiscan.io/tx/${gmxDep.receipt?.txHash ?? ""}`)
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
                View on Arbiscan
              </button>
            </OkBanner>
          )}

          {gmxDep.status === "unconfirmed" && (
            <div className="warn-banner" style={{ display: "block" }}>
              Deposit submitted but GM tokens not received within 90s. Check your wallet; keeper
              execution may still be pending.
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 4 }}
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* ── LendModule (Aave + Pendle + HLP + GMX) ─────────────────────────────── */

export function PerpDexSection() {
  const { data: perp } = usePerpVaults();
  return (
    <div className="emod">
      <div className="emod-h">
        <h3>Perp DEX LP · be the house</h3>
        <p>Stablecoin LPs are the counterparty to perp traders. Earn the spread plus funding.</p>
      </div>
      <div className="ytiles" style={{ marginTop: 14 }}>
        <HlpPanel aprPct={perp?.hyperliquid?.aprPct ?? null} />
        <GmxPanel gmx={perp?.gmx ?? []} />
      </div>
    </div>
  );
}

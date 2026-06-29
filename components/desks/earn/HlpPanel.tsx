"use client";

import {
  HLP_CHAIN_ID,
  HLP_VAULT,
  hlpUsdcHumanToRaw,
  useHlpDeposit,
  validateHlpDepositAmount,
} from "@/lib/desks/hlpDeposit";
import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "../ConnectButton";
import { BTN_PRI, BTN_PRI_DIS, RetryErrorRow, StatusBanner, WrongChainBanner } from "./shared";

// ─── HlpPanel ─────────────────────────────────────────────────────────────────
export function HlpPanel({
  hl,
  isLoading,
}: {
  hl: { aprPct: number | null; name?: string; followers?: number; url?: string } | null | undefined;
  isLoading: boolean;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const hlp = useHlpDeposit(address);

  const [open, setOpen] = useState(false);
  const [usdcAmount, setUsdcAmount] = useState("");

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
        return "Waiting for HL account credit…";
      case "delegating":
        return "Sign vault deposit in wallet…";
      case "polling":
        return "Confirming vault deposit…";
      default:
        return "Deposit to HLP";
    }
  };

  return (
    <div
      style={{
        border: open ? "1.5px solid var(--brand-3)" : "1px solid var(--line)",
        background: open ? "#fff" : "var(--bg-soft)",
        borderRadius: 13,
        transition: ".14s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        type="button"
        style={{
          padding: 15,
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
            hlp.reset();
            setOpen(true);
          }
        }}
      >
        <div
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
          }}
        >
          Hyperliquid HLP
        </div>
        <div style={{ marginTop: 3, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 800,
              fontSize: 30,
              color: "var(--ink)",
            }}
          >
            {isLoading ? "…" : hl?.aprPct != null ? `${hl.aprPct.toFixed(2)}%` : "—"}
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>APR</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
          {hl?.name ?? "Hyperliquidity Provider"}
        </div>
        {hl?.followers != null && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted-2)" }}>
            {hl.followers.toLocaleString()} followers
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: open ? "var(--brand)" : "var(--muted-2)",
          }}
        >
          {open ? "Close ✕" : "Deposit ↓"}
        </div>
      </button>

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
          {!isConnected && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Connect your wallet to deposit.
              </div>
              <ConnectButton />
            </>
          )}

          {isConnected && !onChain && (
            <WrongChainBanner
              message="HLP deposit goes through Arbitrum."
              onSwitch={() => switchChain({ chainId: HLP_CHAIN_ID })}
              switchLabel="Switch to Arbitrum"
            />
          )}

          {isConnected && onChain && hlp.status !== "success" && hlp.status !== "unconfirmed" && (
            <>
              {/* How it works */}
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--muted)",
                  lineHeight: 1.55,
                  background: "var(--bg-soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 9,
                  padding: "8px 11px",
                }}
              >
                <strong>2-step process:</strong> (1) USDC bridged from Arbitrum to your HL account.
                (2) You sign a vault deposit into HLP. Both happen from your connected wallet.
              </div>

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
                  USDC to deposit (Arbitrum)
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
                    disabled={busy}
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
                {amountErr && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--no)" }}>{amountErr}</div>
                )}
              </div>

              {/* Step progress */}
              {busy && (
                <StatusBanner variant="info" style={{ padding: "8px 11px" }}>
                  {hlp.status === "bridging" && "Step 1/2 · Bridging USDC to Hyperliquid…"}
                  {hlp.status === "crediting" && "Step 1/2 · Waiting for HL credit (up to 90s)…"}
                  {hlp.status === "delegating" && "Step 2/2 · Sign vault deposit in wallet…"}
                  {hlp.status === "polling" && "Step 2/2 · Confirming vault deposit…"}
                </StatusBanner>
              )}

              <button
                type="button"
                disabled={!canDeposit}
                onClick={handleDeposit}
                style={canDeposit ? BTN_PRI : BTN_PRI_DIS}
              >
                {btnLabel()}
              </button>
            </>
          )}

          {hlp.status === "error" && hlp.error && (
            <RetryErrorRow message={hlp.error} onRetry={() => hlp.reset()} />
          )}

          {hlp.status === "success" && hlp.receipt && (
            <StatusBanner variant="success" style={{ padding: "11px 13px", fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>HLP deposit confirmed</div>
              <div style={{ fontSize: 12 }}>
                Deposited {hlp.receipt.hlUsdAmount.toFixed(2)} USDC into HLP
              </div>
              {hlp.receipt.vaultEquity && (
                <div style={{ fontSize: 11, marginTop: 2, color: "#0a7a53aa" }}>
                  Vault equity: ${hlp.receipt.vaultEquity}
                </div>
              )}
              <a
                href={`https://arbiscan.io/tx/${hlp.receipt.bridgeTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: "var(--brand)", marginTop: 4, display: "block" }}
              >
                View bridge tx on Arbiscan ↗
              </a>
            </StatusBanner>
          )}

          {hlp.status === "unconfirmed" && (
            <StatusBanner variant="warning" style={{ padding: "9px 12px", fontSize: 12 }}>
              Bridge tx confirmed. Vault deposit was submitted but equity is not yet visible. Check
              your Hyperliquid account.
            </StatusBanner>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  GMX_CHAIN_ID,
  gmxUsdcHumanToRaw,
  useGmxDeposit,
  validateGmxDepositAmount,
} from "@/lib/desks/gmxDeposit";
import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "../ConnectButton";
import { BTN_PRI, BTN_PRI_DIS, RetryErrorRow, StatusBanner, WrongChainBanner } from "./shared";

// ─── GmxPanel ─────────────────────────────────────────────────────────────────
export function GmxPanel({
  gmx,
  isLoading,
}: {
  gmx: { name: string; marketToken: string; apyPct: number; url: string }[];
  isLoading: boolean;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [selectedMarket, setSelectedMarket] = useState<{
    name: string;
    marketToken: string;
    apyPct: number;
  } | null>(null);
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
        return "Approve USDC in wallet…";
      case "depositing":
        return "Sign deposit tx in wallet…";
      case "awaiting":
        return "Request confirmed · awaiting keeper execution…";
      default:
        return selectedMarket
          ? `Deposit into ${selectedMarket.name.split(" ")[0]} GM pool`
          : "Select a pool";
    }
  };

  return (
    <div
      style={{
        border: openPanel ? "1.5px solid var(--brand-3)" : "1px solid var(--line)",
        background: openPanel ? "#fff" : "var(--bg-soft)",
        borderRadius: 13,
        transition: ".14s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 15 }}>
        <div
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
          }}
        >
          GMX v2 GM pools · Arbitrum
        </div>
        {isLoading && (
          <div
            style={{
              marginTop: 12,
              height: 24,
              borderRadius: 6,
              background: "var(--line)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
        {!isLoading && gmx.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            No stable-paired GM pools right now.
          </div>
        )}
        {!isLoading && gmx.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
            {gmx.map((p) => (
              <button
                key={p.marketToken}
                type="button"
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
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 8px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: "var(--muted)",
                  transition: ".12s",
                  background:
                    selectedMarket?.marketToken === p.marketToken && openPanel
                      ? "var(--bg-tint)"
                      : "none",
                  border:
                    selectedMarket?.marketToken === p.marketToken && openPanel
                      ? "1px solid var(--brand-3)"
                      : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    color: "var(--yes)",
                    flexShrink: 0,
                  }}
                >
                  {p.apyPct > 0 ? `${p.apyPct.toFixed(2)}%` : "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline deposit panel */}
      {openPanel && selectedMarket && (
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
              message="GMX pools are on Arbitrum."
              onSwitch={() => switchChain({ chainId: GMX_CHAIN_ID })}
              switchLabel="Switch to Arbitrum"
            />
          )}

          {isConnected &&
            onChain &&
            gmxDep.status !== "success" &&
            gmxDep.status !== "unconfirmed" && (
              <>
                {/* Execution fee notice */}
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
                  Depositing USDC single-sided into <strong>{selectedMarket.name}</strong>. GMX
                  keepers execute the deposit within ~60s. Requires ~0.0003 ETH on Arbitrum for
                  keeper execution fee.
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
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--no)" }}>
                      {amountErr}
                    </div>
                  )}
                </div>

                {/* Quote note — keeper executes at oracle price */}
                {amountNum > 0 && !amountErr && (
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--bg-soft)",
                      padding: "10px 13px",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    GM tokens received at market-rate oracle execution by GMX keepers. No price
                    impact estimate is available before execution.
                  </div>
                )}

                {gmxDep.status === "awaiting" && (
                  <StatusBanner variant="info" style={{ padding: "8px 11px" }}>
                    Deposit request confirmed. Keeper execution takes up to 90s; GM tokens will
                    appear in your wallet.
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

          {gmxDep.status === "error" && gmxDep.error && (
            <RetryErrorRow message={gmxDep.error} onRetry={() => gmxDep.reset()} />
          )}

          {gmxDep.status === "success" && gmxDep.receipt && (
            <StatusBanner variant="success" style={{ padding: "11px 13px", fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>GM pool deposit confirmed</div>
              {gmxDep.receipt.gmReceived ? (
                <div style={{ fontSize: 12 }}>Received {gmxDep.receipt.gmReceived} GM tokens</div>
              ) : (
                <div style={{ fontSize: 12 }}>
                  Deposit request submitted. GM tokens pending keeper execution; check your wallet.
                </div>
              )}
              <a
                href={`https://arbiscan.io/tx/${gmxDep.receipt.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: "var(--brand)", marginTop: 4, display: "block" }}
              >
                View on Arbiscan ↗
              </a>
            </StatusBanner>
          )}

          {gmxDep.status === "unconfirmed" && (
            <StatusBanner variant="warning" style={{ padding: "9px 12px", fontSize: 12 }}>
              Deposit request submitted but GM tokens not received within 90s. Check your wallet;
              keeper execution may still be pending.
            </StatusBanner>
          )}

          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: "8px 0",
              borderRadius: 9,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              fontFamily: "var(--f-ui)",
              fontSize: 12,
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

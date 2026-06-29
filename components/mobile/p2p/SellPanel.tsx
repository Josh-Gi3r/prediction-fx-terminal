"use client";

/**
 * components/mobile/p2p/SellPanel.tsx
 * SELL + SEND sub-tabs of the P2P screen.
 *
 * IMPORTANT: The exact-amount approval (maxApprove: false) is preserved exactly
 * as in the original P2PScreen.tsx ~line 856-861. This differs from the desktop
 * useCreateDeposit which supports multi-platform, whitelist hooks, vault delegation,
 * and the desktop toast system — mobile uses its own simpler single-platform flow.
 */

import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { usePeerClient } from "@/lib/peer/client";
import {
  PEER_FIAT_CURRENCIES,
  PEER_PAYMENT_PLATFORMS,
  parseUnitsExact,
  usdcToBaseUnits,
} from "@/lib/peer/config";
import { trackPeerDeposit } from "@/lib/peer/intentStore";
import { openExternal } from "@/lib/telegram/openExternal";
import { wagmiConfig } from "@/lib/wagmi/config";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { Icon } from "../Icon";
import {
  BASE_CHAIN_ID,
  ERC20_TRANSFER_ABI,
  PLAT_COLORS,
  SHIELD,
  type SellTxState,
  type SendTxState,
  Sw,
  card,
  flag,
  fmt,
  platDisplayName,
  platInitials,
  techLabel,
} from "./shared";

const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

interface Picker {
  title: string;
  items: { value: string; ic: React.ReactNode; t: string; s?: string }[];
  cb: (v: string) => void;
}

interface SellPanelProps {
  onToast: (msg: string) => void;
  liveRates: Record<string, number | null>;
  ratesLoading: Record<string, boolean>;
  picker: Picker | null;
  setPicker: (p: Picker | null) => void;
  pickerQ: string;
  setPickerQ: (q: string) => void;
}

export function SellPanel({
  onToast,
  liveRates,
  ratesLoading,
  picker,
  setPicker,
  pickerQ,
  setPickerQ,
}: SellPanelProps) {
  const [sellMode, setSellMode] = useState<"sell" | "send">("sell");
  const [adv, setAdv] = useState(false);

  const [sell, setSell] = useState({
    amt: "",
    plat: "revolut",
    cur: "USD",
    handle: "",
    rate: "",
    min: "10",
    vOn: false,
    vSel: "4S Boost",
  });

  const [send, setSend] = useState({ amt: "", to: "" });

  const [sellTxState, setSellTxState] = useState<SellTxState>("idle");
  const [sellTxHash, setSellTxHash] = useState<string | null>(null);
  const [sellTxError, setSellTxError] = useState<string | null>(null);

  const [sendTxState, setSendTxState] = useState<SendTxState>("idle");
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  const [sendTxError, setSendTxError] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const peerClient = usePeerClient();
  const { writeContractAsync } = useWriteContract();

  // ── Real USDC balance on Base ──────────────────────────────────────────────
  const { data: usdcBalRaw } = useReadContract({
    address: USDC_BASE_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 20_000 },
  });
  // USDC has 6 decimals; present as a human-readable number
  const usdcBalance: number | null =
    usdcBalRaw != null ? Number(formatUnits(usdcBalRaw as bigint, 6)) : null;

  // ── Computed values ────────────────────────────────────────────────────────
  const sellAmt = Number.parseFloat((sell.amt || "").replace(/,/g, "")) || 0;
  const smidLive = liveRates[sell.cur] ?? null;
  const smidLoading = ratesLoading[sell.cur] ?? false;
  const smid = smidLive ?? 1;
  const srate = sell.vOn ? null : Number.parseFloat(sell.rate) || (smidLive ? smid * 1.005 : null);
  const sprem = srate && smidLive ? (srate / smid - 1) * 100 : null;

  const sendAmt = Number.parseFloat((send.amt || "").replace(/,/g, "")) || 0;
  const isValidAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());

  // Sell CTA
  const sellIsPending = sellTxState === "approving" || sellTxState === "creating";
  let sctaTxt = "";
  let sctaOff = true;
  if (sellTxState === "approving") {
    sctaTxt = "Approving USDC…";
  } else if (sellTxState === "creating") {
    sctaTxt = "Creating deposit…";
  } else if (sellTxState === "success") {
    sctaTxt = "Deposit live";
  } else if (!isConnected || !address) {
    sctaTxt = "Connect wallet";
    sctaOff = false;
  } else if (chainId !== BASE_CHAIN_ID) {
    sctaTxt = "Switch to Base";
    sctaOff = false;
  } else if (!sellAmt) {
    sctaTxt = "Enter an amount";
  } else if (!sell.handle.trim()) {
    const p = PEER_PAYMENT_PLATFORMS.find((x) => x.key === sell.plat);
    sctaTxt = `Enter your ${p?.displayName ?? ""} handle`;
  } else {
    sctaOff = false;
    sctaTxt = "Deposit USDC · escrow";
  }

  // Send CTA
  const sendIsPending = sendTxState === "sending";
  let dctaTxt = "";
  let dctaOff = true;
  if (sendTxState === "sending") {
    dctaTxt = "Sending…";
  } else if (sendTxState === "confirmed") {
    dctaTxt = "Sent";
  } else if (!isConnected || !address) {
    dctaTxt = "Connect wallet";
    dctaOff = false;
  } else if (chainId !== BASE_CHAIN_ID) {
    dctaTxt = "Switch to Base";
    dctaOff = false;
  } else if (!sendAmt) {
    dctaTxt = "Enter an amount";
  } else if (!send.to.trim()) {
    dctaTxt = "Enter a recipient";
  } else if (!isValidAddress(send.to)) {
    dctaTxt = "Enter a 0x address";
  } else {
    dctaOff = false;
    dctaTxt = `Send ${fmt(sendAmt, 2)} USDC`;
  }

  // ── Platform picker items ──────────────────────────────────────────────────
  const platItems = () =>
    PEER_PAYMENT_PLATFORMS.map((p) => ({
      value: p.key,
      ic: (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 7,
            background: PLAT_COLORS[p.key] ?? "var(--brand)",
            color: "#fff",
            fontFamily: "var(--f-tech)",
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {platInitials(p.key)}
        </span>
      ),
      t: p.displayName,
      s: p.currencies.slice(0, 5).join(" · "),
    }));

  const curItems = (codes: string[]) =>
    codes.map((c) => ({
      value: c,
      ic: <span style={{ fontSize: 23, lineHeight: "1" }}>{flag(c)}</span>,
      t: c,
      s: PEER_FIAT_CURRENCIES.find((f) => f.code === c)?.name,
    }));

  // ── Real sell handler ──────────────────────────────────────────────────────
  async function handleSell() {
    if (!isConnected || !address) {
      onToast("Connect wallet to deposit");
      return;
    }
    if (chainId !== BASE_CHAIN_ID) {
      switchChain({ chainId: BASE_CHAIN_ID });
      return;
    }
    if (!peerClient) {
      onToast("Wallet not ready on Base. Try reconnecting.");
      return;
    }
    if (!sellAmt || !sell.handle.trim()) return;

    setSellTxError(null);
    setSellTxHash(null);

    try {
      const amountBigint = usdcToBaseUnits(String(sellAmt));
      const minIntent = usdcToBaseUnits(sell.min || "10");
      const rateNum = srate ?? smid;
      const rateStr = parseUnitsExact(rateNum.toFixed(6), 18).toString();

      setSellTxState("approving");
      // Exact-amount approval — maxApprove: false (preserved from original ~line 856-861)
      const { hadAllowance, hash: approvalHash } = await peerClient.ensureAllowance({
        token: USDC_BASE_ADDRESS,
        amount: amountBigint,
        maxApprove: false,
      });
      if (!hadAllowance && approvalHash) {
        onToast(`USDC approved · tx ${approvalHash.slice(0, 10)}…`);
      }

      setSellTxState("creating");
      const { hash } = await peerClient.createDeposit({
        token: USDC_BASE_ADDRESS,
        amount: amountBigint,
        intentAmountRange: { min: minIntent, max: amountBigint },
        processorNames: [sell.plat],
        payeeData: [{ offchainId: sell.handle.trim() }],
        conversionRates: [[{ currency: sell.cur, conversionRate: rateStr }]],
      });

      trackPeerDeposit(address, {
        depositId: hash,
        owner: address,
        platforms: [sell.plat],
        usdcAmount: String(sellAmt),
        status: "active",
        createdAt: Date.now(),
      });

      setSellTxHash(hash);
      setSellTxState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSellTxError(msg.slice(0, 200));
      setSellTxState("error");
    }
  }

  // ── Real send handler ──────────────────────────────────────────────────────
  async function handleSend() {
    if (!isConnected || !address) {
      onToast("Connect wallet to send");
      return;
    }
    if (chainId !== BASE_CHAIN_ID) {
      switchChain({ chainId: BASE_CHAIN_ID });
      return;
    }
    if (!sendAmt || !isValidAddress(send.to)) return;

    setSendTxError(null);
    setSendTxHash(null);

    try {
      setSendTxState("sending");
      const value = parseUnits(String(sendAmt), 6);
      const hash = await writeContractAsync({
        address: USDC_BASE_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [send.to.trim() as `0x${string}`, value],
        chainId: BASE_CHAIN_ID,
      });

      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: BASE_CHAIN_ID });
      setSendTxHash(hash);
      setSendTxState("confirmed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSendTxError(msg.slice(0, 200));
      setSendTxState("error");
    }
  }

  // ── Rate label for sell form ───────────────────────────────────────────────
  const SellMidLabel = () => {
    if (smidLoading) return <span style={{ color: "var(--muted-2)", fontSize: 11 }}>Loading…</span>;
    if (smidLive == null) return <span style={{ color: "var(--muted-2)" }}>— {sell.cur}</span>;
    return <span>Mid {fmt(smidLive, 4)} · sugg. +0.50%</span>;
  };

  // ── Current platform info ──────────────────────────────────────────────────
  const curPlat = PEER_PAYMENT_PLATFORMS.find((x) => x.key === sell.plat)!;

  // ── Max button helpers ─────────────────────────────────────────────────────
  // Disabled when wallet is not connected or balance hasn't loaded yet.
  const maxDisabled = !isConnected || usdcBalance === null;
  const maxLabel = !isConnected
    ? "Connect wallet · Max"
    : usdcBalance === null
      ? "Loading… · Max"
      : `${fmt(usdcBalance, 2)} USDC · Max`;

  return (
    <div style={{ margin: "0 18px 0" }}>
      {/* Sub-tabs: SELL / SEND */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 14,
        }}
      >
        <div className="seg" style={{ flex: 1 }}>
          {(["sell", "send"] as const).map((k) => (
            <button
              type="button"
              key={k}
              className={sellMode === k ? "on" : ""}
              onClick={() => setSellMode(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        {sellMode === "sell" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginLeft: 12,
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".06em",
              color: "var(--muted)",
            }}
          >
            ADV <Sw sm on={adv} onClick={() => setAdv((a) => !a)} />
          </div>
        )}
      </div>

      {/* ── SELL sub-form ── */}
      {sellMode === "sell" && (
        <>
          {/* Deposit amount */}
          <div className="swap-panel">
            <div className="sp-top">
              <span>Deposit amount</span>
              <button
                type="button"
                disabled={maxDisabled}
                onClick={() => {
                  if (usdcBalance !== null) {
                    setSell((s) => ({ ...s, amt: usdcBalance.toFixed(6) }));
                  }
                }}
                style={{
                  color: maxDisabled ? "var(--muted-2)" : "var(--brand)",
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  cursor: maxDisabled ? "default" : "pointer",
                }}
              >
                {maxLabel}
              </button>
            </div>
            <div className="sp-row">
              <button type="button" className="tokbtn" style={{ cursor: "default" }}>
                <span className="fl">＄</span>USDC
              </button>
              <input
                className="right"
                value={sell.amt}
                onChange={(e) => {
                  setSell((s) => ({ ...s, amt: e.target.value.replace(/[^0-9.,]/g, "") }));
                  if (sellTxState !== "idle") {
                    setSellTxState("idle");
                    setSellTxHash(null);
                    setSellTxError(null);
                  }
                }}
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Platform + Currency selectors */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              margin: "10px 0",
            }}
          >
            <button
              type="button"
              style={{
                ...card,
                padding: "11px 13px",
                textAlign: "left",
                cursor: "pointer",
              }}
              onClick={() =>
                setPicker({
                  title: "Platform",
                  items: platItems(),
                  cb: (v) =>
                    setSell((s) => ({
                      ...s,
                      plat: v,
                      cur: PEER_PAYMENT_PLATFORMS.find((x) => x.key === v)?.currencies.includes(
                        s.cur,
                      )
                        ? s.cur
                        : (PEER_PAYMENT_PLATFORMS.find((x) => x.key === v)?.currencies[0] ?? s.cur),
                    })),
                })
              }
            >
              <div style={techLabel}>Platform</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 800,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: 7,
                    background: PLAT_COLORS[sell.plat] ?? "var(--brand)",
                    color: "#fff",
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: Math.round(20 * 0.42),
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {platInitials(sell.plat)}
                </span>
                {curPlat?.displayName ?? sell.plat}
                <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: 10 }}>▾</span>
              </div>
            </button>

            <button
              type="button"
              style={{
                ...card,
                padding: "11px 13px",
                textAlign: "left",
                cursor: "pointer",
              }}
              onClick={() =>
                setPicker({
                  title: "Currency",
                  items: curItems(curPlat?.currencies ?? ["USD"]),
                  cb: (v) => setSell((s) => ({ ...s, cur: v })),
                })
              }
            >
              <div style={techLabel}>Currency</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 800,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontSize: 17, lineHeight: "1" }}>{flag(sell.cur)}</span>
                {sell.cur}
                <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: 10 }}>▾</span>
              </div>
            </button>
          </div>

          {/* Handle input */}
          <div className="swap-panel">
            <div className="sp-top">
              <span>
                Your {curPlat?.displayName} {curPlat?.offchainIdHint ? "ID" : "handle"} · buyers pay
                you here
              </span>
            </div>
            <input
              value={sell.handle}
              onChange={(e) => setSell((s) => ({ ...s, handle: e.target.value }))}
              placeholder={curPlat?.offchainIdHint ?? "your handle"}
              style={{
                width: "100%",
                border: 0,
                background: "none",
                outline: "none",
                fontFamily: "var(--f-ui)",
                fontWeight: 600,
                fontSize: 15,
                marginTop: 8,
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Rate input (only when not vault-managed) */}
          {!sell.vOn ? (
            <div className="swap-panel" style={{ marginTop: 10 }}>
              <div className="sp-top">
                <span>Your rate · {sell.cur} per USDC</span>
                <SellMidLabel />
              </div>
              <div className="sp-row">
                <input
                  value={sell.rate}
                  onChange={(e) =>
                    setSell((s) => ({ ...s, rate: e.target.value.replace(/[^0-9.,]/g, "") }))
                  }
                  inputMode="decimal"
                  placeholder={smidLive != null ? fmt(smidLive * 1.005, 4) : "—"}
                  style={{ fontSize: 24 }}
                />
              </div>
            </div>
          ) : (
            <div
              className="swap-panel"
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}
            >
              {SHIELD}
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>Vault will manage rates</span>
            </div>
          )}

          {/* Advanced: delegate to vault row */}
          {adv && (
            <div
              style={{
                ...card,
                marginTop: 10,
                overflow: "hidden",
              }}
            >
              {/* Option header row — explicit flex with gap so labels never merge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "12px 14px",
                }}
              >
                {/* Icon */}
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--bg-tint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--brand)",
                  }}
                >
                  {SHIELD}
                </span>

                {/* Label block — two separate lines */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    Delegate to vault
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--muted)",
                      marginTop: 2,
                      display: "block",
                    }}
                  >
                    Non-custodial rate management
                  </div>
                </div>

                <Sw on={sell.vOn} onClick={() => setSell((s) => ({ ...s, vOn: !s.vOn }))} />
              </div>
            </div>
          )}

          {/* Advanced: min order */}
          {adv && (
            <div
              style={{
                ...card,
                marginTop: 10,
                padding: "11px 13px",
              }}
            >
              <div style={techLabel}>Min order size (USDC)</div>
              <input
                value={sell.min}
                onChange={(e) =>
                  setSell((s) => ({ ...s, min: e.target.value.replace(/[^0-9.,]/g, "") }))
                }
                inputMode="decimal"
                placeholder="10"
                style={{
                  border: 0,
                  background: "none",
                  outline: "none",
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 20,
                  color: "var(--ink)",
                  width: "100%",
                }}
              />
            </div>
          )}

          {/* Summary breakdown */}
          {sellAmt > 0 && (
            <div className="brk" style={{ marginTop: 10 }}>
              <div className="r">
                <span className="k">Escrow</span>
                <span className="v">{fmt(sellAmt, 2)} USDC · withdraw anytime</span>
              </div>
              {srate ? (
                <div className="r">
                  <span className="k">Your rate</span>
                  <span className="v">
                    1 USDC = {fmt(srate, 4)} {sell.cur}{" "}
                    {sprem != null ? `(${sprem >= 0 ? "+" : ""}${sprem.toFixed(2)}%)` : ""}
                  </span>
                </div>
              ) : (
                <div className="r">
                  <span className="k">Rate</span>
                  <span className="v">managed by {sell.vSel}</span>
                </div>
              )}
              <div className="r">
                <span className="k">Network</span>
                <span className="v">Base · USDC</span>
              </div>
            </div>
          )}

          {/* Tx success */}
          {sellTxState === "success" && sellTxHash && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--yes-soft, #eafaf1)",
                border: "1px solid var(--yes, #22c55e)",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--yes)" }}>Deposit live.</strong> USDC is in escrow on
              Base. Buyers paying {sell.cur} via {curPlat?.displayName} will settle to your account.{" "}
              <button
                type="button"
                onClick={() => openExternal(`https://basescan.org/tx/${sellTxHash}`)}
                style={{
                  color: "var(--brand)",
                  fontWeight: 600,
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--f-ui)",
                  fontSize: "inherit",
                }}
              >
                View tx ↗
              </button>
            </div>
          )}

          {/* Tx error */}
          {sellTxState === "error" && sellTxError && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--no-soft, #fef2f2)",
                border: "1px solid var(--no, #ef4444)",
                fontSize: 12.5,
                color: "var(--no)",
                lineHeight: 1.5,
              }}
            >
              {sellTxError}
            </div>
          )}

          {!isConnected || !address ? (
            <ConnectWalletButton style={{ marginTop: 14 }} />
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 14, opacity: sctaOff ? 0.55 : 1 }}
              disabled={sctaOff}
              onClick={handleSell}
            >
              {sctaTxt}
            </button>
          )}
        </>
      )}

      {/* ── SEND sub-form ── */}
      {sellMode === "send" && (
        <>
          <div className="swap-panel">
            <div className="sp-top">
              <span>Amount</span>
              <button
                type="button"
                disabled={maxDisabled}
                onClick={() => {
                  if (usdcBalance !== null) {
                    setSend((s) => ({ ...s, amt: usdcBalance.toFixed(6) }));
                  }
                }}
                style={{
                  color: maxDisabled ? "var(--muted-2)" : "var(--brand)",
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  cursor: maxDisabled ? "default" : "pointer",
                }}
              >
                {maxLabel}
              </button>
            </div>
            <div className="sp-row">
              <button type="button" className="tokbtn" style={{ cursor: "default" }}>
                <span className="fl">＄</span>USDC
              </button>
              <input
                className="right"
                value={send.amt}
                onChange={(e) => {
                  setSend((s) => ({ ...s, amt: e.target.value.replace(/[^0-9.,]/g, "") }));
                  if (sendTxState !== "idle") {
                    setSendTxState("idle");
                    setSendTxHash(null);
                    setSendTxError(null);
                  }
                }}
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="swap-panel" style={{ marginTop: 10 }}>
            <div className="sp-top">
              <span>Recipient</span>
              <span style={{ fontSize: 11, color: "var(--muted-2)" }}>0x address only</span>
            </div>
            <input
              value={send.to}
              onChange={(e) => {
                setSend((s) => ({ ...s, to: e.target.value }));
                if (sendTxState !== "idle") {
                  setSendTxState("idle");
                  setSendTxHash(null);
                  setSendTxError(null);
                }
              }}
              placeholder="0x…"
              style={{
                width: "100%",
                border: 0,
                background: "none",
                outline: "none",
                fontFamily: "var(--f-ui)",
                fontWeight: 600,
                fontSize: 15,
                marginTop: 8,
                color: "var(--ink)",
              }}
            />
            {send.to.trim() && !isValidAddress(send.to) && (
              <div style={{ fontSize: 11, color: "var(--no)", marginTop: 4 }}>
                Only 0x addresses supported
              </div>
            )}
          </div>

          <div className="brk" style={{ marginTop: 10 }}>
            <div className="r">
              <span className="k">Network</span>
              <span className="v">Base · settles &lt;1s</span>
            </div>
            <div className="r">
              <span className="k">Token</span>
              <span className="v">USDC (Base)</span>
            </div>
            <div className="r">
              <span className="k">Fee</span>
              <span className="v" style={{ color: "var(--yes)" }}>
                gas only (~$0.01)
              </span>
            </div>
          </div>

          {sendTxState === "confirmed" && sendTxHash && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--yes-soft, #eafaf1)",
                border: "1px solid var(--yes, #22c55e)",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--yes)" }}>Sent.</strong> {fmt(sendAmt, 2)} USDC
              transferred.{" "}
              <button
                type="button"
                onClick={() => openExternal(`https://basescan.org/tx/${sendTxHash}`)}
                style={{
                  color: "var(--brand)",
                  fontWeight: 600,
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--f-ui)",
                  fontSize: "inherit",
                }}
              >
                View tx ↗
              </button>
            </div>
          )}

          {sendTxState === "error" && sendTxError && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--no-soft, #fef2f2)",
                border: "1px solid var(--no, #ef4444)",
                fontSize: 12.5,
                color: "var(--no)",
                lineHeight: 1.5,
              }}
            >
              {sendTxError}
            </div>
          )}

          {!isConnected || !address ? (
            <ConnectWalletButton style={{ marginTop: 14 }} />
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 14, opacity: dctaOff ? 0.55 : 1 }}
              disabled={dctaOff}
              onClick={handleSend}
            >
              {dctaTxt}
            </button>
          )}
        </>
      )}

      {/* ── How it works ── */}
      <div className="sec-head onlight" style={{ marginTop: 30 }}>
        <h2>How it works</h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          [
            "01 · ESCROW",
            "Lock stablecoins",
            "Deposit USDC into escrow and set your platform, currency and rate.",
          ],
          [
            "02 · INTENT",
            "A buyer takes your offer",
            "A buyer commits onchain to your deposit. Your escrow is reserved at your quoted rate.",
          ],
          [
            "03 · PAY",
            "They pay you in fiat",
            "The buyer sends fiat to your Wise, Revolut or Venmo at the quoted rate. Your USDC stays escrowed until proof.",
          ],
          [
            "04 · PROVE",
            "Proof releases escrow",
            "A zk payment proof verifies the transfer; USDC releases to the buyer. ~2 min.",
          ],
        ].map(([n, b, p]) => (
          <div
            key={n}
            style={{
              ...card,
              padding: "13px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontWeight: 700,
                fontSize: 10,
                color: "var(--brand)",
                letterSpacing: ".12em",
                display: "block",
                marginBottom: 6,
              }}
            >
              {n}
            </div>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{b}</strong>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

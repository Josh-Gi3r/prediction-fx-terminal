"use client";

import {
  type FxMarket,
  useCapabilities,
  useConfig,
  useScan,
  useFxMarkets,
  useTokens,
} from "@/lib/desks/hooks";
import { assembleVlBatch } from "@/lib/desks/vl";
import { addVlBatch } from "@/lib/desks/vlStore";
import { fmt, fromRaw, toRaw } from "@/lib/fx-provider/core/format";
import { buildOrderTypedData } from "@/lib/fx-provider/core/order";
import { FX_VAULT_ABI } from "@/lib/fx-provider/core/types";
import { wagmiConfig } from "@/lib/wagmi/config";
import {
  readContract,
  sendTransaction,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { CONTRACT_DEFAULTS } from "@/config/contracts";
import { useMemo, useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { ConnectButton } from "../ConnectButton";
import { CARD, INNER_CARD, SEC_FEAT, SumRow } from "./shared";

// ─── VLPanel ──────────────────────────────────────────────────────────────────
export function VLPanel({
  address,
  isConnected,
}: {
  address?: `0x${string}`;
  isConnected: boolean;
}) {
  const { data: tokens } = useTokens();
  const { data: marketsData } = useFxMarkets();
  const { data: config } = useConfig();
  const { data: capabilities } = useCapabilities();
  const usdc = tokens?.find((t) => t.symbol === "USDC");
  const vault = (config?.vault_address ??
    CONTRACT_DEFAULTS[1]!.vault) as `0x${string}`;

  const { data: vaultBalRaw, refetch: refetchVault } = useReadContract({
    address: vault,
    abi: FX_VAULT_ABI,
    functionName: "balanceOf",
    args: [usdc?.address as `0x${string}`, address as `0x${string}`],
    query: { enabled: !!address && !!usdc },
  });
  const vaultBal = vaultBalRaw && usdc ? Number(fromRaw(vaultBalRaw as bigint, usdc.decimals)) : 0;

  const [depStatus, setDepStatus] = useState<
    "idle" | "approving" | "depositing" | "done" | "error"
  >("idle");
  const [depMsg, setDepMsg] = useState<string | null>(null);
  const depBusy = depStatus === "approving" || depStatus === "depositing";

  async function depositToVault() {
    if (!usdc || !address) return;
    setDepMsg(null);
    const shortfall = Math.max(0, (Number(amount) || 0) - vaultBal);
    const need = shortfall > 0 ? shortfall : Number(amount) || 0;
    if (need <= 0) {
      setDepMsg("Enter a budget amount first");
      return;
    }
    const amountRaw = toRaw(String(need), usdc.decimals);
    try {
      const allowance = (await readContract(wagmiConfig, {
        address: usdc.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, vault],
      })) as bigint;
      if (allowance < BigInt(amountRaw)) {
        setDepStatus("approving");
        const ah = await writeContract(wagmiConfig, {
          address: usdc.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, BigInt(amountRaw)],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: ah });
      }
      setDepStatus("depositing");
      const res = await fetch("/api/fx-deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: usdc.address, owner: address, amount: amountRaw }),
      });
      const env = await res.json();
      if (env.needsKey) {
        setDepStatus("idle");
        setDepMsg("In-app deposit needs a FX Provider API key. Fund on your-fx-provider.example.com for now.");
        return;
      }
      if (env.error || !env.to || !env.data) throw new Error(env.error ?? "deposit build failed");
      const hash = await sendTransaction(wagmiConfig, {
        to: env.to as `0x${string}`,
        data: env.data as `0x${string}`,
        value: env.value ? BigInt(env.value) : undefined,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchVault();
      setDepStatus("done");
      setDepMsg(`Deposited ${fmt(need, 2)} USDC to vault`);
    } catch (e) {
      setDepStatus("error");
      setDepMsg((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    }
  }

  const usdcBaseMarkets = (marketsData?.markets ?? []).filter(
    (m) => usdc && m.base_address.toLowerCase() === usdc.address.toLowerCase(),
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [spreadBps, setSpreadBps] = useState(25);
  const [maxLegs, setMaxLegs] = useState(10);

  function toggle(addr: string) {
    setSelected((s) =>
      s.includes(addr) ? s.filter((x) => x !== addr) : s.length >= maxLegs ? s : [...s, addr],
    );
  }

  const amountNum = Number(amount) || 0;
  const perLeg = selected.length > 0 ? amountNum / selected.length : 0;

  const scan = useScan(usdc ?? undefined, tokens, 1000);
  const midByAddr = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of scan.data?.rows ?? []) {
      const rate =
        r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok
          ? r.fxProvider.rate
          : r.kyber && "ok" in r.kyber && r.kyber.ok
            ? r.kyber.rate
            : 0;
      if (rate > 0) m[r.address.toLowerCase()] = rate;
    }
    return m;
  }, [scan.data]);

  const { signTypedDataAsync } = useSignTypedData();
  const [vlStatus, setVlStatus] = useState<"idle" | "signing" | "submitting" | "done" | "error">(
    "idle",
  );
  const [vlMsg, setVlMsg] = useState<string | null>(null);
  const [legPrices, setLegPrices] = useState<Record<string, string>>({});
  const priceFor = (addr: string): string => {
    const override = legPrices[addr.toLowerCase()];
    if (override !== undefined) return override;
    const mid = midByAddr[addr.toLowerCase()];
    return mid ? String(mid) : "";
  };

  const allPriced = selected.length >= 2 && selected.every((a) => Number(priceFor(a)) > 0);
  const fundsShort = isConnected && amountNum > vaultBal;
  const vlBusy = vlStatus === "signing" || vlStatus === "submitting";

  async function submitVl() {
    if (!usdc || !config || !address) return;
    setVlMsg(null);
    try {
      const expiration = Math.floor(Date.now() / 1000) + 6 * 3600;
      const perLegStr = (amountNum / selected.length).toFixed(usdc.decimals);
      const legs = selected.map((addr) => {
        const mkt = usdcBaseMarkets.find((m) => m.quote_address === addr)!;
        const ref = Number(priceFor(addr));
        return {
          toToken: mkt.quote_address as `0x${string}`,
          toDecimals: mkt.quote_decimals,
          side: "sell" as const,
          amount: Number(perLegStr),
          price: ref * (1 + spreadBps / 10_000),
        };
      });
      const assembled = assembleVlBatch({
        owner: address,
        fromToken: usdc.address as `0x${string}`,
        fromDecimals: usdc.decimals,
        expiration,
        legs,
      });
      setVlStatus("signing");
      const orders = [];
      for (let i = 0; i < assembled.length; i++) {
        const a = assembled[i];
        const leg = legs[i];
        if (!a || !leg) continue;
        const td = buildOrderTypedData(a.order, config);
        const signature = await signTypedDataAsync(
          td as unknown as Parameters<typeof signTypedDataAsync>[0],
        );
        orders.push({
          owner_address: address,
          side: a.side === "sell" ? "ask" : "bid",
          amount: perLegStr,
          price: String(leg.price),
          order_type: "limit",
          from_address: usdc.address,
          to_address: leg.toToken,
          order_id: a.order_id,
          uuid_int: a.order.uuid.toString(),
          signature,
          expiration,
        });
      }
      setVlStatus("submitting");
      const res = await fetch("/api/vl/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "batch rejected");
      const vlBatchId = String(data.vl_batch_id ?? orders[0]?.order_id);
      addVlBatch({
        vlBatchId,
        owner: address,
        budgetSymbol: "USDC",
        amount: String(amountNum),
        legs: selected.map((a) => ({
          symbol: usdcBaseMarkets.find((m) => m.quote_address === a)?.quote_symbol ?? "?",
          price: priceFor(a),
        })),
        expiration,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setVlStatus("done");
      setVlMsg(`Batch posted · ${orders.length} legs · ${vlBatchId.slice(0, 12)}`);
    } catch (e) {
      setVlStatus("error");
      setVlMsg((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    }
  }

  const vlBtnLabel =
    vlStatus === "signing"
      ? `Sign leg in wallet… (${selected.length})`
      : vlStatus === "submitting"
        ? "Submitting batch…"
        : selected.length < 2
          ? "Select 2+ corridors"
          : !amountNum
            ? "Enter a budget"
            : fundsShort
              ? "Deposit USDC to vault first"
              : !allPriced
                ? "Set a price for every leg"
                : `Sign & submit batch · ${selected.length} legs`;

  return (
    <div style={SEC_FEAT}>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: "var(--f-display)",
            fontWeight: 800,
            fontSize: 20,
            color: "var(--ink)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          Virtual Liquidity · active FX maker
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#fff",
              background: "var(--grad-brand)",
              padding: "4px 9px",
              borderRadius: 7,
              whiteSpace: "nowrap",
            }}
          >
            On-chain, self-custodial
          </span>
        </h3>
        <p
          style={{
            margin: "7px 0 0",
            fontSize: 12.5,
            color: "var(--muted)",
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          One USDC budget backs up to 20 SEA-FX corridors at once. The matching engine freezes only
          your <strong>largest</strong> leg, so the same capital quotes USDC→XSGD, USDC→EURC, and
          every other corridor simultaneously. You earn the spread on every fill. Deposit USDC to
          the vault, then sign one batch of orders.
        </p>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}
        className="vl-grid"
      >
        {/* LEFT: budget + spread */}
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Budget */}
          <div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              Budget
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
              <span
                style={{
                  fontFamily: "var(--f-ui)",
                  fontWeight: 800,
                  fontSize: 14,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "8px 11px",
                  whiteSpace: "nowrap",
                }}
              >
                🇺🇸 USDC
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
                placeholder="0.0"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: "none",
                  textAlign: "right",
                  fontFamily: "var(--f-display)",
                  fontWeight: 800,
                  fontSize: 26,
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 11.5,
                color: "var(--muted)",
                marginTop: 6,
                whiteSpace: "nowrap",
              }}
            >
              <span>In vault</span>
              <span style={{ fontFamily: "var(--f-tech)" }}>
                {isConnected ? `${fmt(vaultBal, 2)} USDC` : "connect wallet"}
              </span>
            </div>
            {isConnected &&
              fundsShort &&
              (capabilities?.fxDeposit === false ? (
                <a
                  href="https://your-fx-provider.example.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    marginTop: 8,
                    width: "100%",
                    padding: "8px 0",
                    border: "1px solid var(--line)",
                    borderRadius: 9,
                    background: "#fff",
                    fontFamily: "var(--f-ui)",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--ink)",
                    textAlign: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  Fund on your-fx-provider.example.com ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={depositToVault}
                  disabled={depBusy}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "8px 0",
                    border: "1px solid var(--line)",
                    borderRadius: 9,
                    background: "#fff",
                    cursor: depBusy ? "not-allowed" : "pointer",
                    fontFamily: "var(--f-ui)",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--ink)",
                    transition: ".15s",
                    opacity: depBusy ? 0.6 : 1,
                  }}
                >
                  {depStatus === "approving"
                    ? "Approve USDC in wallet…"
                    : depStatus === "depositing"
                      ? "Depositing to vault…"
                      : `Deposit ${fmt(Math.max(0, amountNum - vaultBal), 2)} USDC to vault`}
                </button>
              ))}
            {depMsg && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
                {depMsg}
                {depMsg.includes("your-fx-provider.example.com") && (
                  <a
                    href="https://your-fx-provider.example.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--brand)", fontWeight: 700, marginLeft: 4 }}
                  >
                    open ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Spread slider */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  letterSpacing: ".13em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                }}
              >
                Spread over mid
              </div>
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                {spreadBps} bps
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              value={spreadBps}
              onChange={(e) => setSpreadBps(Number(e.target.value))}
              style={{ width: "100%", marginTop: 9, accentColor: "var(--brand)" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 9.5,
                color: "var(--muted-2)",
              }}
            >
              <span>5 bps</span>
              <span>200 bps</span>
            </div>
          </div>

          {/* Max legs */}
          <div>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
                marginBottom: 8,
              }}
            >
              Max legs
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[5, 10, 20].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setMaxLegs(n)}
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 12,
                    border: "1px solid var(--line)",
                    background: maxLegs === n ? "var(--grad-brand)" : "#fff",
                    color: maxLegs === n ? "#fff" : "var(--muted)",
                    padding: "6px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    borderColor: maxLegs === n ? "transparent" : undefined,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={INNER_CARD}>
            <SumRow k="Selected corridors">
              {selected.length} / {maxLegs}
            </SumRow>
            <SumRow k="Per-leg amount">{perLeg ? `${fmt(perLeg, 2)} USDC` : "—"}</SumRow>
            <SumRow k="Frozen (largest leg)">{perLeg ? `${fmt(perLeg, 2)} USDC` : "—"}</SumRow>
          </div>

          {/* Leg prices (shown when corridors are selected) */}
          {selected.length > 0 && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 11,
                padding: "11px 13px",
                background: "#fff",
              }}
            >
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
                Leg prices · USDC → (mid prefilled; edit to bootstrap)
              </div>
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {selected.map((addr) => {
                  const mkt = usdcBaseMarkets.find((m) => m.quote_address === addr);
                  const hasMid = (midByAddr[addr.toLowerCase()] ?? 0) > 0;
                  return (
                    <div
                      key={addr}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                    >
                      <span
                        style={{ width: 64, flexShrink: 0, fontWeight: 600, color: "var(--ink)" }}
                      >
                        {mkt?.quote_symbol ?? "—"}
                      </span>
                      <input
                        inputMode="decimal"
                        value={priceFor(addr)}
                        onChange={(e) =>
                          /^\d*\.?\d*$/.test(e.target.value) &&
                          setLegPrices((p) => ({ ...p, [addr.toLowerCase()]: e.target.value }))
                        }
                        placeholder={hasMid ? "" : "set price"}
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          border: "1px solid var(--line)",
                          background: "var(--bg-soft)",
                          padding: "4px 8px",
                          textAlign: "right",
                          fontFamily: "var(--f-tech)",
                          outline: "none",
                          fontSize: 12,
                        }}
                      />
                      <span
                        style={{ width: 40, flexShrink: 0, fontSize: 9, color: "var(--muted-2)" }}
                      >
                        {hasMid ? "mid" : "new"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isConnected ? (
            <ConnectButton />
          ) : (
            <button
              type="button"
              onClick={submitVl}
              disabled={selected.length < 2 || !amountNum || vlBusy || fundsShort || !allPriced}
              style={
                selected.length < 2 || !amountNum || vlBusy || fundsShort || !allPriced
                  ? {
                      width: "100%",
                      padding: 13,
                      borderRadius: 12,
                      border: 0,
                      cursor: "not-allowed",
                      fontFamily: "var(--f-ui)",
                      fontWeight: 800,
                      fontSize: 14,
                      background: "var(--line-2)",
                      color: "#fff",
                      boxShadow: "none",
                      transition: ".15s",
                      opacity: 0.5,
                    }
                  : {
                      width: "100%",
                      padding: 13,
                      borderRadius: 12,
                      border: 0,
                      cursor: "pointer",
                      fontFamily: "var(--f-ui)",
                      fontWeight: 800,
                      fontSize: 14,
                      background: "var(--grad-brand)",
                      color: "#fff",
                      boxShadow: "var(--sh-brand)",
                      transition: ".15s",
                    }
              }
            >
              {vlBtnLabel}
            </button>
          )}

          {vlMsg && (
            <div
              style={{
                borderRadius: 9,
                border: "1px solid",
                padding: "8px 11px",
                fontSize: 12,
                borderColor: vlStatus === "done" ? "rgba(19,185,129,.4)" : "rgba(240,67,106,.4)",
                background: vlStatus === "done" ? "rgba(19,185,129,.08)" : "rgba(240,67,106,.08)",
                color: vlStatus === "done" ? "#0a7a53" : "#b61441",
              }}
            >
              {vlMsg}
            </div>
          )}
        </div>

        {/* RIGHT: corridor multi-select */}
        <div style={{ ...CARD, gap: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 9,
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              USDC-base corridors · {usdcBaseMarkets.length} live
            </span>
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              {selected.length} picked
            </span>
          </div>
          <div
            style={{
              maxHeight: 336,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              paddingRight: 4,
            }}
          >
            {usdcBaseMarkets.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted-2)", padding: "8px 4px" }}>
                Loading…
              </div>
            )}
            {usdcBaseMarkets.map((m) => (
              <MarketRow
                key={m.quote_address}
                market={m}
                checked={selected.includes(m.quote_address)}
                onToggle={() => toggle(m.quote_address)}
                disabled={!selected.includes(m.quote_address) && selected.length >= maxLegs}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{"@media(max-width:760px){.vl-grid{grid-template-columns:1fr!important}}"}</style>
    </div>
  );
}

// ─── MarketRow ────────────────────────────────────────────────────────────────
function MarketRow({
  market,
  checked,
  onToggle,
  disabled,
}: {
  market: FxMarket;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "9px 10px",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: ".12s",
        border: `1px solid ${checked ? "var(--brand-3)" : "transparent"}`,
        background: checked ? "var(--bg-tint)" : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            border: checked ? "0" : "1.5px solid var(--line-2)",
            background: checked ? "var(--brand)" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 10,
            color: "#fff",
            fontWeight: 800,
          }}
        >
          {checked ? "✓" : ""}
        </span>
        <span style={{ color: "var(--muted-2)", fontSize: 11 }}>USDC →</span>
        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{market.quote_symbol}</span>
      </span>
      <span style={{ fontFamily: "var(--f-tech)", fontSize: 10, color: "var(--muted-2)" }}>
        min {market.min_bid_quote_amount ? fmt(Number(market.min_bid_quote_amount), 1) : "—"}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
    </label>
  );
}

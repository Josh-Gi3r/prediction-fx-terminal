"use client";

/**
 * components/mobile/earn/VLMaker.tsx
 * Virtual Liquidity — full real flow, mirrors desktop ProvideLiquidityVL.
 * Live USDC-base corridors from /api/fx-markets; mids from /api/scan.
 * Deposit USDC to the settlement vault in-app, then sign one batch of orders per leg
 * (signTypedData via wagmi) and POST /api/vl/batch — same path as desktop.
 *
 * NOTE: useCapabilities gate is PRESERVED byte-exact (fxDeposit branch).
 */

import { useCapabilities, useConfig, useScan, useFxMarkets, useTokens } from "@/lib/desks/hooks";
import { assembleVlBatch } from "@/lib/desks/vl";
import { addVlBatch } from "@/lib/desks/vlStore";
import { fmt, fromRaw, toRaw } from "@/lib/fx-provider/core/format";
import { buildOrderTypedData } from "@/lib/fx-provider/core/order";
import { FX_VAULT_ABI } from "@/lib/fx-provider/core/types";
import { openExternal } from "@/lib/telegram/openExternal";
import { wagmiConfig } from "@/lib/wagmi/config";
import {
  readContract,
  sendTransaction,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { useMemo, useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { MobileConnectButton } from "./primitives";

const fmt2 = fmt; // alias — same function, avoids shadowing

export function VLMaker({ onToast }: { onToast: (msg: string) => void }) {
  const { address, isConnected } = useAccount();
  const { data: tokens } = useTokens();
  const { data: marketsData } = useFxMarkets();
  const { data: config } = useConfig();
  const { data: capabilities } = useCapabilities();
  const usdc = tokens?.find((t) => t.symbol === "USDC");
  const vault = (config?.vault_address ??
    "0xC7d4Fd2638e6630C8C61329878676b88A8A24D43") as `0x${string}`;

  const { data: vaultBalRaw, refetch: refetchVault } = useReadContract({
    address: vault,
    abi: FX_VAULT_ABI,
    functionName: "balanceOf",
    args: [usdc?.address as `0x${string}`, address as `0x${string}`],
    query: { enabled: !!address && !!usdc },
  });
  const vaultBal = vaultBalRaw && usdc ? Number(fromRaw(vaultBalRaw as bigint, usdc.decimals)) : 0;

  const usdcBaseMarkets = (marketsData?.markets ?? []).filter(
    (m) => usdc && m.base_address.toLowerCase() === usdc.address.toLowerCase(),
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [maxLegs, setMaxLegs] = useState(10);
  const [spreadBps, setSpreadBps] = useState(25);
  const [amtStr, setAmtStr] = useState("10000");

  const amt = Number.parseFloat((amtStr || "").replace(/,/g, "")) || 0;
  const per = selected.length ? amt / selected.length : 0;

  // Live mids per corridor (FX provider, fallback Kyber) from /api/scan.
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

  const [legPrices, setLegPrices] = useState<Record<string, string>>({});
  const priceFor = (addr: string): string => {
    const override = legPrices[addr.toLowerCase()];
    if (override !== undefined) return override;
    const mid = midByAddr[addr.toLowerCase()];
    return mid ? String(mid) : "";
  };

  const allPriced = selected.length >= 2 && selected.every((a) => Number(priceFor(a)) > 0);
  const fundsShort = isConnected && amt > vaultBal;

  const toggle = (addr: string) => {
    setSelected((s) =>
      s.includes(addr) ? s.filter((x) => x !== addr) : s.length >= maxLegs ? s : [...s, addr],
    );
  };

  const setLegs = (n: number) => {
    setMaxLegs(n);
    setSelected((s) => s.slice(0, n));
  };

  // ── Vault deposit (mirrors desktop depositToVault) ──────────────────────────
  const [depStatus, setDepStatus] = useState<
    "idle" | "approving" | "depositing" | "done" | "error"
  >("idle");
  const [depMsg, setDepMsg] = useState<string | null>(null);
  const depBusy = depStatus === "approving" || depStatus === "depositing";

  async function depositToVault() {
    if (!usdc || !address) return;
    setDepMsg(null);
    const shortfall = Math.max(0, amt - vaultBal);
    const need = shortfall > 0 ? shortfall : amt;
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
      setDepMsg(`Deposited ${fmt2(need, 2)} USDC to vault`);
      onToast(`Deposited ${fmt2(need, 2)} USDC to vault`);
    } catch (e) {
      setDepStatus("error");
      const m = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setDepMsg(m);
      onToast(`Deposit failed · ${m}`);
    }
  }

  // ── Batch sign + submit (mirrors desktop submitVl) ──────────────────────────
  const { signTypedDataAsync } = useSignTypedData();
  const [vlStatus, setVlStatus] = useState<"idle" | "signing" | "submitting" | "done" | "error">(
    "idle",
  );
  const [vlMsg, setVlMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const vlBusy = vlStatus === "signing" || vlStatus === "submitting";

  async function submitVl() {
    if (!usdc || !config || !address) return;
    setVlMsg(null);
    try {
      const expiration = Math.floor(Date.now() / 1000) + 6 * 3600;
      const perLegStr = (amt / selected.length).toFixed(usdc.decimals);
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
        amount: String(amt),
        legs: selected.map((a) => ({
          symbol: usdcBaseMarkets.find((m) => m.quote_address === a)?.quote_symbol ?? "?",
          price: priceFor(a),
        })),
        expiration,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setVlStatus("done");
      const t = `Batch posted · ${orders.length} legs · ${vlBatchId.slice(0, 12)}`;
      setVlMsg({ ok: true, t });
      onToast(t);
    } catch (e) {
      setVlStatus("error");
      const m = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setVlMsg({ ok: false, t: m });
      onToast(`VL batch failed · ${m}`);
    }
  }

  const btnLabel =
    vlStatus === "signing"
      ? `Sign leg in wallet… (${selected.length})`
      : vlStatus === "submitting"
        ? "Submitting batch…"
        : selected.length < 2
          ? "Select 2+ corridors"
          : !amt
            ? "Enter a budget"
            : fundsShort
              ? "Deposit USDC to vault first"
              : !allPriced
                ? "Set a price for every leg"
                : `Sign & submit batch · ${selected.length} legs`;

  const canSubmit =
    isConnected && selected.length >= 2 && !!amt && !vlBusy && !fundsShort && allPriced;

  return (
    <div className="emod feat fade-in">
      <div className="emod-h">
        <h3>
          Virtual Liquidity <span className="tagm">On-chain, self-custodial</span>
        </h3>
        <p>
          One USDC budget backs up to 20 SEA-FX corridors at once. The engine freezes only your{" "}
          <strong>largest</strong> leg, so the same capital quotes every pair simultaneously. You
          earn the spread on every fill. Deposit USDC to the vault, then sign one batch of orders.
        </p>
      </div>

      {!isConnected && <MobileConnectButton />}

      <div className="efield">
        <div className="eyebrow-sm">Budget</div>
        <div className="ebudget">
          <span className="ccy">USDC</span>
          <input
            value={amtStr}
            onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.,]/g, ""))}
            inputMode="decimal"
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 6,
          }}
        >
          <span>In vault</span>
          <span style={{ fontFamily: "var(--f-tech)" }}>
            {isConnected ? `${fmt2(vaultBal, 2)} USDC` : "connect wallet"}
          </span>
        </div>
        {isConnected &&
          fundsShort &&
          (capabilities?.fxDeposit === false ? (
            <button
              type="button"
              onClick={() => openExternal("https://your-fx-provider.example.com")}
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8, textAlign: "center" }}
            >
              Fund on your-fx-provider.example.com ↗
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8 }}
              onClick={depositToVault}
              disabled={depBusy}
            >
              {depStatus === "approving"
                ? "Approve USDC in wallet…"
                : depStatus === "depositing"
                  ? "Depositing to vault…"
                  : `Deposit ${fmt2(Math.max(0, amt - vaultBal), 2)} USDC to vault`}
            </button>
          ))}
        {depMsg && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
            {depMsg}
            {depMsg.includes("your-fx-provider.example.com") && (
              <button
                type="button"
                onClick={() => openExternal("https://your-fx-provider.example.com")}
                style={{
                  color: "var(--brand)",
                  fontWeight: 700,
                  marginLeft: 4,
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "var(--f-ui)",
                  fontSize: "inherit",
                }}
              >
                open ↗
              </button>
            )}
          </div>
        )}
      </div>

      <div className="efield">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="eyebrow-sm">Spread over mid</div>
          <span style={{ fontFamily: "var(--f-tech)", fontWeight: 700, fontSize: 14 }}>
            {spreadBps} bps
          </span>
        </div>
        <input
          className="erange"
          type="range"
          min="5"
          max="200"
          value={spreadBps}
          onChange={(e) => setSpreadBps(+e.target.value)}
        />
        <div className="eends">
          <span>5 bps</span>
          <span>200 bps</span>
        </div>
        <div className="eyebrow-sm" style={{ marginTop: 12 }}>
          Max legs
        </div>
        <div className="leg-seg">
          {[5, 10, 20].map((n) => (
            <button
              type="button"
              key={n}
              className={maxLegs === n ? "on" : ""}
              onClick={() => setLegs(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="esum">
        <div className="r">
          <span className="k">Selected corridors</span>
          <span className="v">
            {selected.length} / {maxLegs}
          </span>
        </div>
        <div className="r">
          <span className="k">Per-leg amount</span>
          <span className="v">{per ? `${per.toFixed(2)} USDC` : "—"}</span>
        </div>
        <div className="r">
          <span className="k">Frozen (largest leg)</span>
          <span className="v">{per ? `${per.toFixed(2)} USDC` : "—"}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0 9px",
        }}
      >
        <div className="eyebrow-sm">USDC corridors · {usdcBaseMarkets.length} live</div>
        <div className="eyebrow-sm">{selected.length} picked</div>
      </div>
      {usdcBaseMarkets.length === 0 && <div className="subnote">Loading live corridors…</div>}
      {usdcBaseMarkets.map((m) => {
        const on = selected.includes(m.quote_address);
        const dis = !on && selected.length >= maxLegs;
        return (
          <div
            key={m.quote_address}
            className={`mkt-row${on ? " on" : ""}${dis ? " dis" : ""}`}
            onClick={() => !dis && toggle(m.quote_address)}
          >
            <span className="l">
              <span className="cb">{on ? "✓" : ""}</span>
              <span className="ar">USDC →</span> <b>{m.quote_symbol}</b>
            </span>
            <span className="min">
              min {m.min_bid_quote_amount ? fmt2(Number(m.min_bid_quote_amount), 1) : "—"}
            </span>
          </div>
        );
      })}

      {/* Leg prices — mid prefilled; edit to bootstrap a new corridor */}
      {selected.length > 0 && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 11,
            padding: "11px 13px",
            background: "#fff",
            marginTop: 12,
          }}
        >
          <div className="eyebrow-sm" style={{ marginBottom: 8 }}>
            Leg prices · USDC → (mid prefilled; edit to bootstrap)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selected.map((addr) => {
              const mkt = usdcBaseMarkets.find((m) => m.quote_address === addr);
              const hasMid = (midByAddr[addr.toLowerCase()] ?? 0) > 0;
              return (
                <div
                  key={addr}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                >
                  <span style={{ width: 56, flexShrink: 0, fontWeight: 700, color: "var(--ink)" }}>
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
                      minWidth: 0,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "var(--bg-soft)",
                      padding: "6px 9px",
                      textAlign: "right",
                      fontFamily: "var(--f-tech)",
                      outline: "none",
                      fontSize: 12,
                    }}
                  />
                  <span style={{ width: 30, flexShrink: 0, fontSize: 9, color: "var(--muted-2)" }}>
                    {hasMid ? "mid" : "new"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 14, opacity: canSubmit ? 1 : 0.5 }}
        disabled={!canSubmit}
        onClick={submitVl}
      >
        {btnLabel}
      </button>
      {vlMsg && (
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            marginTop: 10,
            borderRadius: 9,
            border: "1px solid",
            padding: "8px 11px",
            borderColor: vlMsg.ok ? "rgba(19,185,129,.4)" : "rgba(240,67,106,.4)",
            background: vlMsg.ok ? "rgba(19,185,129,.08)" : "rgba(240,67,106,.08)",
            color: vlMsg.ok ? "#0a7a53" : "#b61441",
          }}
        >
          {vlMsg.t}
        </div>
      )}
    </div>
  );
}

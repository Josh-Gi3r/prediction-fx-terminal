"use client";

import { currencyFlag } from "@/lib/desks/currency";
import { type ScanRow, useScan, useTokens } from "@/lib/desks/hooks";
import { fmt, fromRaw } from "@/lib/fx-provider/core/format";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { useEffect, useMemo, useState } from "react";
import { TokenPicker } from "./TokenPicker";

const PROBE_AMOUNTS = [100, 1000, 10000];
// One-tap "from" switches so rates across many directions are easy to discover.
const QUICK_FROM = ["USDC", "USDT", "XSGD", "STBL", "EURC", "DAI", "USDe", "PYUSD"];

export function RatesCard({
  onSwapPair,
}: {
  onSwapPair?: (from: FxToken, to: FxToken) => void;
} = {}) {
  const { data: tokens } = useTokens();
  const [from, setFrom] = useState<FxToken | null>(null);
  const [probe, setProbe] = useState<number>(1000);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "fx-provider" | "kyber" | "both">("all");

  useEffect(() => {
    if (tokens && !from) setFrom(tokens.find((t) => t.symbol === "USDC") ?? tokens[0] ?? null);
  }, [tokens, from]);

  const scan = useScan(from ?? undefined, tokens, probe);

  const rows = scan.data?.rows ?? [];
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (q && !r.symbol.toLowerCase().includes(q)) return false;
      const s = !!(r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok);
      const p = !!(r.kyber && "ok" in r.kyber && r.kyber.ok);
      if (filter === "fx-provider") return s;
      if (filter === "kyber") return p;
      if (filter === "both") return s && p;
      return true;
    });
    return sortRows(filtered);
  }, [rows, query, filter]);
  const fromSym = from?.symbol ?? "—";

  const counts = useMemo(() => {
    let fxProviderLive = 0;
    let psLive = 0;
    let both = 0;
    for (const r of rows) {
      const s = r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok;
      const l = r.kyber && "ok" in r.kyber && r.kyber.ok;
      if (s) fxProviderLive++;
      if (l) psLive++;
      if (s && l) both++;
    }
    return { total: rows.length, fxProviderLive, psLive, both };
  }, [rows]);

  return (
    <section className="wrap mkt-wrap">
      <RatesStyles />
      <div className="tape">
        {/* Header */}
        <div className="tape-h">
          <div>
            <div className="eyebrow">
              <span className="tick" />
              Live tape
            </div>
            <h2>Rates across FX Provider &amp; DeFi</h2>
          </div>
          <div className="counts">
            <b>{counts.total}</b> pairs · <b>{counts.fxProviderLive}</b> FX Provider · <b>{counts.psLive}</b>{" "}
            Kyber · <b>{counts.both}</b> both
          </div>
        </div>

        {/* Quick-from chips */}
        {tokens && (
          <div className="fromrow">
            <span className="lab">From</span>
            {QUICK_FROM.map((sym) => {
              const t = tokens.find((x) => x.symbol === sym);
              if (!t) return null;
              const active = from?.symbol === sym;
              return (
                <button
                  type="button"
                  key={sym}
                  className={`qf${active ? " on" : ""}`}
                  onClick={() => setFrom(t)}
                >
                  <span className="fl">{currencyFlag(t.currency)}</span>
                  {sym}
                </button>
              );
            })}
            <button type="button" className="qf more" onClick={() => setPickerOpen(true)}>
              more…
            </button>
          </div>
        )}

        {/* Controls row */}
        <div className="controls">
          <span className="lbl">Quote at</span>
          <div className="seg">
            {PROBE_AMOUNTS.map((a) => (
              <button
                type="button"
                key={a}
                className={probe === a ? "on" : ""}
                onClick={() => setProbe(a)}
              >
                {a.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="filt">
            {(["all", "fx-provider", "kyber", "both"] as const).map((f) => (
              <button
                type="button"
                key={f}
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter symbol…"
            autoComplete="off"
          />
          <span className="right">
            {scan.isFetching ? "scanning…" : `from ${fromSym} · ${probe.toLocaleString()} size`}
          </span>
        </div>

        {scan.isError && (
          <div
            style={{
              borderRadius: 9,
              border: "1px solid rgba(240,67,106,.4)",
              background: "rgba(240,67,106,.08)",
              padding: "8px 12px",
              fontSize: 12,
              color: "#b61441",
              marginBottom: 10,
            }}
          >
            Scan failed: {String((scan.error as Error)?.message ?? scan.error)}
          </div>
        )}

        {scan.isLoading && !scan.data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                key={i}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "var(--bg-soft)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="tbl">
            <div className="thead">
              <div>{fromSym} →</div>
              <div className="r">FX Provider</div>
              <div className="r">KyberSwap</div>
              <div className="r">Spread</div>
              <div className="r">Best</div>
            </div>
            <div className="tbody">
              {sorted.map((r) => (
                <RateRow
                  key={r.address}
                  row={r}
                  fromSym={fromSym}
                  currency={
                    tokens?.find((t) => t.address.toLowerCase() === r.address.toLowerCase())
                      ?.currency
                  }
                  onSwap={
                    onSwapPair && from && tokens
                      ? () => {
                          const to = tokens.find(
                            (t) => t.address.toLowerCase() === r.address.toLowerCase(),
                          );
                          if (to) onSwapPair(from, to);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="note">
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6.3" stroke="var(--brand)" strokeWidth="1.2" fill="none" />
            <path
              d="M7.5 6.6v4M7.5 4.4v.6"
              stroke="var(--brand)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span>
            The FX provider lists regional FX stablecoins that no DEX aggregator carries. On those corridors it
            is the only venue (Kyber shows <em>no route</em>). Where both desks quote, a wide spread
            is a discovery edge. Tap any row to open it in Swap.
          </span>
        </div>

        {pickerOpen && tokens && (
          <TokenPicker
            tokens={tokens}
            title="Quote from"
            onSelect={(t) => {
              setFrom(t);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </section>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function sortRows(rows: ScanRow[]): ScanRow[] {
  // Live (any source) first, then by best rate desc.
  return [...rows].sort((a, b) => {
    const aLive = isAnyOk(a) ? 1 : 0;
    const bLive = isAnyOk(b) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return bestRate(b) - bestRate(a);
  });
}

function isAnyOk(r: ScanRow): boolean {
  return !!((r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok) || (r.kyber && "ok" in r.kyber && r.kyber.ok));
}

function bestRate(r: ScanRow): number {
  const s = r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok ? r.fxProvider.rate : 0;
  const l = r.kyber && "ok" in r.kyber && r.kyber.ok ? r.kyber.rate : 0;
  return Math.max(s, l);
}

function RateRow({
  row,
  fromSym,
  currency,
  onSwap,
}: {
  row: ScanRow;
  fromSym: string;
  currency?: string;
  onSwap?: () => void;
}) {
  const fxProviderOk = row.fxProvider && "ok" in row.fxProvider && row.fxProvider.ok;
  const kyberOk = row.kyber && "ok" in row.kyber && row.kyber.ok;
  const tool = kyberOk ? (row.kyber as { tool: string }).tool : "";
  const fxProviderOut = fxProviderOk
    ? Number(fromRaw((row.fxProvider as { outRaw: string }).outRaw, row.decimals))
    : 0;
  const kyberOut = kyberOk
    ? Number(fromRaw((row.kyber as { outRaw: string }).outRaw, row.decimals))
    : 0;
  let spreadBps: number | null = null;
  if (fxProviderOk && kyberOk && fxProviderOut > 0 && kyberOut > 0) {
    const better = Math.max(fxProviderOut, kyberOut);
    const worse = Math.min(fxProviderOut, kyberOut);
    spreadBps = ((better - worse) / worse) * 10_000;
  }

  return (
    <div
      className="trow"
      onClick={onSwap}
      onKeyDown={onSwap ? (e) => e.key === "Enter" && onSwap() : undefined}
      role={onSwap ? "button" : undefined}
      tabIndex={onSwap ? 0 : undefined}
    >
      <span className="pair">
        <span className="fl">{currencyFlag(currency)}</span>
        <span className="ar">{fromSym} →</span> {row.symbol}
      </span>

      {/* FX Provider column */}
      {fxProviderOk ? (
        <span className={`px ${row.bestSource === "fx-provider" ? "lead" : "dim"}`}>
          {fmt(fxProviderOut, 4)}
        </span>
      ) : (
        <span className="dash">—</span>
      )}

      {/* Kyber column */}
      {kyberOk ? (
        <span className={`px ${row.bestSource === "kyber" ? "lead" : "dim"}`}>
          {fmt(kyberOut, 4)}
          {tool && <span className="tool">{tool}</span>}
        </span>
      ) : (
        <span className="dash">—</span>
      )}

      {/* Spread */}
      {spreadBps != null ? (
        <span className={`spread ${spreadBps > 10 ? "wide" : "tight"}`}>
          {spreadBps.toFixed(1)} bps
        </span>
      ) : (
        <span className="dash">—</span>
      )}

      {/* Best badge */}
      {row.bestSource ? (
        <span className={`bestbadge ${row.bestSource}`}>{row.bestSource} ↗</span>
      ) : (
        <span className="bestbadge none">no route</span>
      )}
    </div>
  );
}

/** Markets-page CSS transplanted verbatim from design-v2 markets.html, .ds4-scoped
 *  (design.css is frozen by Phase 0, so markets-page classes live here). */
function RatesStyles() {
  return (
    <style>{`
.ds4 .mkt-wrap{padding-top:34px;padding-bottom:60px}
.ds4 .tape{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-2);padding:22px 22px 14px}
.ds4 .tape-h{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ds4 .tape-h h2{font-family:var(--f-display);font-weight:800;letter-spacing:-.02em;color:var(--ink);font-size:clamp(22px,2.6vw,30px);margin:5px 0 0}
.ds4 .tape-h .eyebrow{margin-bottom:5px}
.ds4 .counts{font-family:var(--f-tech);font-size:11.5px;color:var(--muted-2);white-space:nowrap}
.ds4 .counts b{color:var(--ink-2)}
.ds4 .fromrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px}
.ds4 .fromrow .lab{font-family:var(--f-tech);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2);margin-right:2px}
.ds4 .qf{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:999px;padding:6px 12px;font-family:var(--f-ui);font-weight:700;font-size:12.5px;cursor:pointer;transition:.14s}
.ds4 .qf .fl{font-size:15px;line-height:1}
.ds4 .qf:hover{border-color:var(--brand-3);color:var(--ink)}
.ds4 .qf.on{border-color:var(--brand);background:var(--bg-tint);color:var(--ink)}
.ds4 .qf.more{border-style:dashed;border-color:var(--line-2)}
.ds4 .controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:var(--bg-soft);border:1px solid var(--line);border-radius:14px;padding:11px 13px;margin-bottom:14px}
.ds4 .controls .seg{display:flex;background:#fff;border:1px solid var(--line);border-radius:10px;padding:2px}
.ds4 .controls .seg button{font-family:var(--f-tech);font-weight:600;font-size:12px;border:0;background:none;color:var(--muted);padding:6px 11px;border-radius:8px;cursor:pointer;transition:.14s}
.ds4 .controls .seg button.on{background:var(--grad-brand);color:#fff}
.ds4 .controls .lbl{font-size:12px;color:var(--muted)}
.ds4 .controls .filt{display:flex;background:#fff;border:1px solid var(--line);border-radius:10px;padding:2px}
.ds4 .controls .filt button{font-family:var(--f-tech);font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;border:0;background:none;color:var(--muted);padding:6px 9px;border-radius:7px;cursor:pointer}
.ds4 .controls .filt button.on{background:var(--navy);color:#fff}
.ds4 .controls input{border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-size:12.5px;outline:none;width:140px;font-family:var(--f-ui)}
.ds4 .controls input:focus{border-color:var(--brand)}
.ds4 .controls .right{margin-left:auto;font-family:var(--f-tech);font-size:11px;color:var(--muted-2)}
.ds4 .tbl{border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ds4 .thead,.ds4 .trow{display:grid;grid-template-columns:1.3fr 1fr 1fr 0.7fr 0.7fr;gap:12px;align-items:center;padding:11px 16px}
.ds4 .thead{background:var(--bg-soft);border-bottom:1px solid var(--line);font-family:var(--f-tech);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2)}
.ds4 .thead .r,.ds4 .trow .r{text-align:right}
.ds4 .tbody{max-height:60vh;overflow-y:auto}
.ds4 .trow{border-bottom:1px solid var(--line);font-size:14px;transition:.12s;cursor:pointer;background:#fff}
.ds4 .trow:last-child{border-bottom:0}
.ds4 .trow:hover{background:var(--bg-soft)}
.ds4 .trow .pair{display:flex;align-items:center;gap:9px;font-weight:700}
.ds4 .trow .pair .fl{font-size:18px;line-height:1}
.ds4 .trow .pair .ar{color:var(--muted-2);font-family:var(--f-tech);font-weight:500;font-size:12px}
.ds4 .trow .px{font-family:var(--f-tech);font-weight:600;text-align:right;white-space:nowrap}
.ds4 .trow .px.dim{color:var(--muted-2)}
.ds4 .trow .px.lead{color:var(--ink)}
.ds4 .trow .px .tool{font-size:9px;color:var(--muted-2);margin-left:5px}
.ds4 .trow .dash{color:var(--line-2);text-align:right}
.ds4 .trow .spread{text-align:right;font-family:var(--f-tech);font-size:12.5px}
.ds4 .trow .spread.wide{color:#c2750a}
.ds4 .trow .spread.tight{color:var(--muted)}
.ds4 .bestbadge{justify-self:end;display:inline-flex;align-items:center;gap:4px;font-family:var(--f-tech);font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 8px;border-radius:7px}
.ds4 .bestbadge.fx-provider{color:var(--brand);background:rgba(37,99,235,.12)}
.ds4 .bestbadge.kyber{color:var(--accent-2);background:rgba(16,217,160,.14)}
.ds4 .bestbadge.none{color:var(--muted-2);background:none;font-weight:600;text-transform:none}
.ds4 .note{font-size:11.5px;color:var(--muted);line-height:1.6;margin-top:13px;display:flex;gap:9px}
.ds4 .note svg{flex:0 0 auto;margin-top:2px}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@media(max-width:720px){
  .ds4 .thead{display:none}
  .ds4 .trow{grid-template-columns:1fr auto;gap:6px 12px}
  .ds4 .trow .px,.ds4 .trow .spread{grid-column:1;text-align:left;font-size:12px;color:var(--muted)}
  .ds4 .trow .pair{grid-column:1}
  .ds4 .bestbadge{grid-row:1 / span 3;grid-column:2;align-self:center}
}
`}</style>
  );
}

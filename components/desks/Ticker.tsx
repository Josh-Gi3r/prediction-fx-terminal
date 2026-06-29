"use client";

import { type ScanRow, useScan, useTokens } from "@/lib/desks/hooks";
import { fmt } from "@/lib/fx-provider/core/format";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { useMemo, useRef } from "react";

const TICKER_TARGETS = [
  "USDT",
  "DAI",
  "USDe",
  "PYUSD",
  "FRAX",
  "USDS",
  "GHO",
  "RLUSD",
  "EURC",
  "EURe",
  "XSGD",
  "STBL",
];

export function Marquee({ onSwapPair }: { onSwapPair?: (from: FxToken, to: FxToken) => void }) {
  const { data: tokens } = useTokens();
  const usdc = useMemo(() => tokens?.find((t) => t.symbol === "USDC"), [tokens]);
  const filteredTokens = useMemo(
    () => tokens?.filter((t) => TICKER_TARGETS.includes(t.symbol)) ?? [],
    [tokens],
  );
  const scan = useScan(usdc ?? undefined, [usdc!, ...filteredTokens].filter(Boolean), 1000);
  const prevRef = useRef<Record<string, number>>({});

  if (!scan.data) {
    return (
      <div className="flex h-10 items-center border-b border-border bg-paper px-5 text-[11px] text-faint md:px-8">
        <span className="eyebrow mr-3">Loading tape</span>
        <span className="animate-pulse">…</span>
      </div>
    );
  }

  const ordered = TICKER_TARGETS.map((sym) => scan.data!.rows.find((r) => r.symbol === sym)).filter(
    Boolean,
  ) as ScanRow[];

  // duplicate the list so the marquee loops seamlessly
  const tape = [...ordered, ...ordered];

  return (
    <div className="marquee-pause overflow-hidden border-b border-border bg-paper">
      <div className="relative">
        <div className="marquee-track py-2.5">
          {tape.map((r, idx) => {
            const cur = bestRate(r);
            const prev = prevRef.current[r.address];
            const delta = prev && cur ? (cur - prev) / prev : 0;
            if (idx < ordered.length) prevRef.current[r.address] = cur;
            const tone =
              delta > 0.0001 ? "text-success" : delta < -0.0001 ? "text-danger" : "text-faint";
            const arrow = delta > 0.0001 ? "▲" : delta < -0.0001 ? "▼" : "·";
            const source =
              r.bestSource === "fx-provider"
                ? "FX DESK"
                : r.kyber && "ok" in r.kyber && r.kyber.ok
                  ? (r.kyber.tool || "").slice(0, 12).toUpperCase()
                  : "—";
            const tok = filteredTokens.find((t) => t.address.toLowerCase() === r.address);
            return (
              <button
                type="button"
                key={`${r.address}-${idx}`}
                onClick={() => {
                  if (onSwapPair && usdc && tok) onSwapPair(usdc, tok);
                }}
                className="group flex shrink-0 items-baseline gap-2 px-3 transition hover:opacity-100"
                title={`Swap USDC → ${r.symbol}`}
              >
                <span className="eyebrow !text-faint">USDC / {r.symbol}</span>
                <span className="tabular text-sm font-semibold text-ink">
                  {cur > 0 ? fmt(cur, cur > 100 ? 2 : 4) : "—"}
                </span>
                <span className={`tabular text-[10px] ${tone}`}>{arrow}</span>
                <span className="hidden text-[9px] uppercase tracking-wider text-faint xl:inline">
                  {source}
                </span>
                <span className="ml-1 h-3 w-px bg-border" />
              </button>
            );
          })}
        </div>
        {/* edge fades for elegance */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-paper to-transparent" />
      </div>
    </div>
  );
}

// Back-compat: AppLayout used to import `Ticker`. Provide both names.
export const Ticker = Marquee;

function bestRate(r: ScanRow): number {
  const s = r.fxProvider && "ok" in r.fxProvider && r.fxProvider.ok ? r.fxProvider.rate : 0;
  const p = r.kyber && "ok" in r.kyber && r.kyber.ok ? r.kyber.rate : 0;
  return Math.max(s, p);
}

"use client";

import { CORRIDORS } from "@/lib/corridors/registry";
import { fxClient } from "@/lib/fx-provider";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface Tick {
  pair: string;
  rate: string;
  changePct: string;
  positive: boolean;
}

/**
 * Live ticker tape powered by `GET /fx/rate` per corridor.
 *
 * On error (FX provider unavailable, no data) the row falls back to the registry
 * `refRate` and `refChg` snapshot so the marquee never breaks.
 *
 * We poll every 3s to keep the network usage reasonable; users get sub-second
 * updates on the trade page itself where polling is faster.
 */
export function LiveTickerTape() {
  const queries = useQueries({
    queries: CORRIDORS.map((c) => ({
      queryKey: ["fx-provider", "fx-rate", c.isoBase, c.isoQuote] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => fxClient.fxRate(c.isoBase, c.isoQuote, signal),
      staleTime: 1_500,
      refetchInterval: 3_000,
      retry: 1,
    })),
  });

  const ticks: Tick[] = CORRIDORS.map((c, idx) => {
    const q = queries[idx];
    if (q?.data?.rate) {
      const chg = q.data.change_pct ? Number.parseFloat(q.data.change_pct) : c.refChg;
      const rateNum = Number.parseFloat(q.data.rate);
      return {
        pair: `${c.isoBase}/${c.isoQuote}`,
        rate: rateNum >= 100 ? rateNum.toFixed(2) : rateNum.toFixed(4),
        changePct: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`,
        positive: chg >= 0,
      };
    }
    return {
      pair: `${c.isoBase}/${c.isoQuote}`,
      rate: c.refRate >= 100 ? c.refRate.toFixed(2) : c.refRate.toFixed(4),
      changePct: `${c.refChg >= 0 ? "+" : ""}${c.refChg.toFixed(2)}%`,
      positive: c.refChg >= 0,
    };
  });

  const looped = [...ticks, ...ticks];
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          el.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
        }
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative overflow-hidden border-b border-[var(--color-line-1)] bg-[var(--color-bg-0)]/60">
      <div
        ref={trackRef}
        className="flex w-max items-center gap-8 whitespace-nowrap py-2 [animation:ticker_60s_linear_infinite]"
      >
        {looped.map((t, i) => (
          <div
            key={`${t.pair}-${i}`}
            className="flex items-center gap-2 text-[11px] uppercase tracking-wider"
          >
            <span className="text-[var(--color-fg-2)]">{t.pair}</span>
            <span className="price text-[var(--color-fg-0)]">{t.rate}</span>
            <span
              className={
                t.positive ? "text-[var(--color-accent-green)]" : "text-[var(--color-accent-red)]"
              }
            >
              {t.changePct}
            </span>
            <span className="mx-2 text-[var(--color-fg-3)]">·</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { TradeEntry } from "./helpers";

export interface SparklineProps {
  trades: TradeEntry[];
  width: number;
  height: number;
}

export function Sparkline({ trades, width, height }: SparklineProps) {
  const points = useMemo(() => {
    if (trades.length < 2) return null;
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const prices = sorted.map((t) => t.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    // Floor the visual range so a 1-2¢ oscillation (e.g. 93↔94) renders as a
    // near-flat line, not a full-height sawtooth. Genuine large swings still
    // fill the chart. Centre the data within the padded domain.
    const rawRange = maxP - minP;
    const range = Math.max(rawRange, 0.15);
    const lo = minP - (range - rawRange) / 2;
    const minT = sorted[0]?.timestamp ?? 0;
    const maxT = sorted[sorted.length - 1]?.timestamp ?? 1;
    const tRange = maxT - minT || 1;

    return sorted.map((t, i) => {
      const x = ((t.timestamp - minT) / tRange) * (width - 4) + 2;
      const y = height - ((t.price - lo) / range) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
  }, [trades, width, height]);

  if (!points) return null;

  const pathD = points.join(" ");
  // Fill: area below line
  const firstPt = points[0]?.replace("M", "") ?? "0,0";
  const lastPt = points[points.length - 1]?.replace("L", "") ?? "0,0";
  const areaD = `M${firstPt} ${points.slice(1).join(" ")} L${lastPt.split(",")[0]},${height} L${firstPt.split(",")[0]},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--yes)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-fill)" />
      <path
        d={pathD}
        stroke="var(--yes)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

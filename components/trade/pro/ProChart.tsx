"use client";

import {
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  createChart,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

interface Props {
  mid: number;
  seed: number;
  positive: boolean;
}

const TFS = ["1H", "4H", "1D", "1W"] as const;
type Tf = (typeof TFS)[number];

function genCandles(
  mid: number,
  seed: number,
  count = 120,
): Array<{ time: Time; open: number; high: number; low: number; close: number }> {
  let s = seed * 9319;
  function rnd() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  const now = Math.floor(Date.now() / 1000);
  const step = 3600;
  const out: Array<{ time: Time; open: number; high: number; low: number; close: number }> = [];
  let price = mid * 0.985;
  for (let i = 0; i < count; i++) {
    const time = (now - (count - i) * step) as Time;
    const drift = (rnd() - 0.49) * mid * 0.004;
    const open = price;
    const close = Math.max(0.0001, price + drift);
    const wick = mid * (0.0015 + rnd() * 0.002);
    const high = Math.max(open, close) + wick * rnd();
    const low = Math.min(open, close) - wick * rnd();
    out.push({ time, open, high, low, close });
    price = close;
  }
  return out;
}

export function ProChart({ mid, seed, positive }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [tf, setTf] = useState<Tf>("1H");

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5e6a82",
        fontFamily: '"Chakra Petch", ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(11,20,55,0.05)" },
        horzLines: { color: "rgba(11,20,55,0.05)" },
      },
      rightPriceScale: { borderColor: "rgba(11,20,55,0.08)" },
      timeScale: { borderColor: "rgba(11,20,55,0.08)", timeVisible: true },
      crosshair: { mode: 1 },
      width: containerRef.current.clientWidth,
      height: 360,
    });
    const series = chart.addCandlestickSeries({
      upColor: "#13b981",
      downColor: "#f0436a",
      borderUpColor: "#13b981",
      borderDownColor: "#f0436a",
      wickUpColor: "#13b981",
      wickDownColor: "#f0436a",
    });
    series.setData(genCandles(mid, seed));
    chartRef.current = chart;
    seriesRef.current = series;
    chart.timeScale().fitContent();

    function handleResize() {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [mid, seed]);

  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData(genCandles(mid, seed + TFS.indexOf(tf)));
      chartRef.current?.timeScale().fitContent();
    }
  }, [tf, mid, seed]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--sh-1)",
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Chart
          </span>
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: positive ? "var(--yes)" : "var(--no)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TFS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTf(t)}
              style={{
                borderRadius: 7,
                padding: "3px 8px",
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid transparent",
                background: tf === t ? "var(--navy)" : "transparent",
                color: tf === t ? "#fff" : "var(--muted)",
                transition: "background .15s, color .15s",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 360 }} />
    </div>
  );
}

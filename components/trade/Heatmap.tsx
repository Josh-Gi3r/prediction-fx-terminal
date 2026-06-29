"use client";

import { CORRIDORS } from "@/lib/corridors/registry";

function heatStyle(chg: number): React.CSSProperties {
  const m = Math.max(-0.8, Math.min(0.8, chg)) / 0.8;
  if (m >= 0) {
    const a = 0.12 + 0.5 * m;
    return {
      background: `rgba(19,185,129,${a})`,
      color: "#0a5e43",
      borderColor: `rgba(19,185,129,${a + 0.1})`,
    };
  }
  const a = 0.12 + 0.5 * -m;
  return {
    background: `rgba(240,67,106,${a})`,
    color: "#8a1733",
    borderColor: `rgba(240,67,106,${a + 0.1})`,
  };
}

export function Heatmap() {
  return (
    <div>
      {/* Grid — no card wrapper, matches mockup .heat-grid directly */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 11,
        }}
        className="heat-grid"
      >
        {CORRIDORS.map((c) => {
          const sign = c.refChg >= 0 ? "+" : "";
          return (
            <a
              key={c.sym}
              href={`#${c.sym.replace("/", "-")}`}
              title={`${c.sym} · ${sign}${c.refChg.toFixed(2)}%`}
              style={{
                ...heatStyle(c.refChg),
                position: "relative",
                borderRadius: 15,
                padding: "15px 13px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                cursor: "pointer",
                border: "1px solid transparent",
                overflow: "hidden",
                textDecoration: "none",
                transition: "transform .16s, box-shadow .16s",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: "0.02em",
                }}
              >
                {c.isoQuote}
              </span>
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  opacity: 0.72,
                }}
              >
                {c.refRate >= 100
                  ? c.refRate.toFixed(2)
                  : c.refRate >= 10
                    ? c.refRate.toFixed(3)
                    : c.refRate.toFixed(4)}
              </span>
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 13.5,
                  fontWeight: 700,
                  marginTop: 3,
                }}
              >
                {sign}
                {c.refChg.toFixed(2)}%
              </span>
            </a>
          );
        })}
      </div>

      <style>{`
        .heat-grid a:hover { transform: translateY(-3px); box-shadow: var(--sh-2); }
        .heat-grid a::after { content: ""; position: absolute; inset: 0; background: linear-gradient(155deg, rgba(255,255,255,.4), transparent 55%); pointer-events: none; }
        @media (max-width: 980px) { .heat-grid { grid-template-columns: repeat(4,1fr) !important; } }
        @media (max-width: 560px) { .heat-grid { grid-template-columns: repeat(3,1fr) !important; } }
      `}</style>
    </div>
  );
}

import type React from "react";

"use client";

import { CORRIDORS, type Corridor } from "@/lib/corridors/registry";

interface Props {
  selected: Corridor;
  onSelect: (c: Corridor) => void;
}

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(2);
  if (r >= 10) return r.toFixed(3);
  return r.toFixed(4);
}

export function MarketSelector({ selected, onSelect }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--sh-1)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "9px 12px",
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        Markets
      </div>
      <div style={{ maxHeight: 480, overflowY: "auto" }}>
        {CORRIDORS.map((c) => {
          const active = c.sym === selected.sym;
          const positive = c.refChg >= 0;
          return (
            <button
              key={c.sym}
              type="button"
              onClick={() => onSelect(c)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                borderBottom: "1px solid var(--line)",
                padding: "9px 12px",
                textAlign: "left",
                cursor: "pointer",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 1,
                borderBottomColor: "var(--line)",
                background: active ? "var(--bg-tint)" : "#fff",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-soft)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: active ? "var(--brand)" : "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.sym}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.maxLev}× · {c.tier}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  className="mono"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {fmtRate(c.refRate)}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: positive ? "var(--up)" : "var(--down)",
                  }}
                >
                  {positive ? "+" : ""}
                  {c.refChg.toFixed(2)}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

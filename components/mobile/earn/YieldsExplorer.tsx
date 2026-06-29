"use client";

/**
 * components/mobile/earn/YieldsExplorer.tsx
 * Yields Explorer — research tab (display only, links out).
 * Feed: shared useYields (lib/desks/hooks) — same scored pools as desktop.
 */

import { tvlLabel } from "@/components/mobile/data";
import { useYields } from "@/lib/desks/hooks";
import { useMemo, useState } from "react";

export function YieldsExplorer() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"score" | "apy" | "tvl">("score");
  const { data: yieldsData } = useYields();
  const bench = yieldsData?.benchmark?.rate ?? 3.69;
  const ROWS = useMemo(
    () =>
      (yieldsData?.pools ?? []).map((pool) => {
        const apy = pool.apy ?? 0;
        const tvl = pool.tvlUsd ?? 0;
        // Use server-computed SDYS score and tier — never recompute client-side.
        const tier = pool.tier;
        return {
          pj: pool.project.replace(/-/g, " "),
          sy: pool.symbol,
          ty: pool.chain,
          apy,
          tvl,
          tier,
          excess: pool.excessBps,
          score: pool.score,
        };
      }),
    [yieldsData],
  );
  const f = q.trim().toLowerCase();
  const rows = ROWS.filter(
    (r) => !f || r.pj.toLowerCase().includes(f) || r.sy.toLowerCase().includes(f),
  ).sort((a, b) =>
    sort === "tvl" ? b.tvl - a.tvl : sort === "apy" ? b.apy - a.apy : b.score - a.score,
  );
  return (
    <div className="emod fade-in">
      <div className="emod-h">
        <h3>Stablecoin yields · scored</h3>
        <p>
          Score (0–100) blends excess over the T-Bill, TVL tier, project tier, IL risk and emission
          decay.
        </p>
      </div>
      <div className="bench" style={{ marginTop: 13 }}>
        <span className="eyebrow-sm">Risk-free</span>
        <span className="v">
          US 3M T-Bill <strong>{(yieldsData?.benchmark?.rate ?? 3.69).toFixed(2)}%</strong>
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter project or symbol…"
          style={{
            flex: 1,
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            outline: "none",
            fontFamily: "var(--f-ui)",
            minWidth: 0,
          }}
        />
      </div>
      <div className="seg" style={{ margin: "0 0 12px" }}>
        {(
          [
            ["score", "Score"],
            ["apy", "APY"],
            ["tvl", "TVL"],
          ] as const
        ).map(([k, l]) => (
          <button
            type="button"
            key={k}
            className={sort === k ? "on" : ""}
            onClick={() => setSort(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 13, overflow: "hidden" }}>
        {!yieldsData && (
          <div className="subnote" style={{ padding: 14 }}>
            Loading live pools…
          </div>
        )}
        {rows.map((r) => (
          <div className="yrow" key={`${r.pj}-${r.sy}-${r.ty}`}>
            <span className="pj">
              <span className={`tg ${r.tier}`}>{r.tier}</span>
              {r.pj}
            </span>
            <span className="apy">{r.apy.toFixed(2)}%</span>
            <span className="meta">
              {r.sy} · {r.ty} · {tvlLabel(r.tvl)} ·{" "}
              <span style={{ color: r.excess > 0 ? "var(--yes)" : "var(--no)" }}>
                {r.excess > 0 ? "+" : ""}
                {r.excess} bps
              </span>
            </span>
            <span className={`sc ${r.score >= 70 ? "hi" : r.score >= 50 ? "mid" : "lo"}`}>
              {r.score}
            </span>
          </div>
        ))}
      </div>
      <div className="subnote">
        Data: DeFiLlama · ETH mainnet · scoring inspired by Pharos methodology
      </div>
    </div>
  );
}

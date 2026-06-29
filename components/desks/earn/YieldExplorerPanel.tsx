"use client";

import { type YieldPool, useYields } from "@/lib/desks/hooks";
import { useState } from "react";
import { EarnSection } from "./shared";

// ─── YieldExplorerPanel ───────────────────────────────────────────────────────
export function YieldExplorerPanel() {
  const { data, isLoading } = useYields();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"score" | "apy" | "tvl">("score");

  const pools = data?.pools ?? [];
  const benchmark = data?.benchmark;
  const filtered = pools
    .filter((p) => {
      const query = q.trim().toLowerCase();
      if (!query) return true;
      return p.project.toLowerCase().includes(query) || p.symbol.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (sort === "tvl") return (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0);
      if (sort === "apy") return (b.apy ?? 0) - (a.apy ?? 0);
      return b.score - a.score;
    });

  return (
    <EarnSection
      title="Yield radar · research"
      subtitle="Research tool only; rows link to external venues for deposit. Score (0–100) blends excess over the T-Bill rate, TVL tier, project tier, IL risk, and reward-emission decay."
    >
      {benchmark && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 13px",
            fontSize: 11.5,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
            }}
          >
            Risk-free benchmark
          </span>
          <span
            style={{ fontFamily: "var(--f-tech)", color: "var(--ink-2)", whiteSpace: "nowrap" }}
          >
            {benchmark.code} <strong>{benchmark.rate.toFixed(2)}%</strong> · excess = APY −
            benchmark
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by project or symbol…"
          style={{
            flex: 1,
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 13,
            outline: "none",
            fontFamily: "var(--f-ui)",
          }}
        />
        <div
          style={{
            display: "flex",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 2,
          }}
        >
          {(["score", "apy", "tvl"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSort(s)}
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                fontWeight: 700,
                border: 0,
                background: sort === s ? "var(--navy)" : "none",
                color: sort === s ? "#fff" : "var(--muted)",
                padding: "7px 11px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
              key={i}
              style={{
                height: 36,
                borderRadius: 9,
                border: "1px solid var(--line)",
                background: "var(--bg-soft)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            borderRadius: 13,
            border: "1px solid var(--line)",
            overflow: "hidden",
          }}
        >
          <div style={{ minWidth: 620 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.3fr 0.7fr 0.7fr 0.8fr 0.8fr 0.6fr",
                gap: 10,
                alignItems: "center",
                padding: "11px 15px",
                background: "var(--bg-soft)",
                borderBottom: "1px solid var(--line)",
                fontFamily: "var(--f-tech)",
                fontSize: 9.5,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              <div>Project</div>
              <div>Symbol</div>
              <div style={{ textAlign: "right" }}>Type</div>
              <div style={{ textAlign: "right" }}>APY</div>
              <div style={{ textAlign: "right" }}>Excess</div>
              <div style={{ textAlign: "right" }}>TVL</div>
              <div style={{ textAlign: "right" }}>Score</div>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {filtered.slice(0, 60).map((p) => (
                <YieldRow key={p.id} pool={p} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted-2)" }}>
        Data: DeFiLlama · live every 5min · ETH mainnet · scoring inspired by Pharos methodology
      </div>
    </EarnSection>
  );
}

// ─── YieldRow ─────────────────────────────────────────────────────────────────
function YieldRow({ pool }: { pool: YieldPool }) {
  const tvlM = (pool.tvlUsd ?? 0) / 1_000_000;
  const tvlLabel = tvlM >= 1000 ? `$${(tvlM / 1000).toFixed(1)}B` : `$${tvlM.toFixed(1)}M`;
  const tierColor = { A: "var(--yes)", B: "#c2750a", C: "var(--muted-2)" }[pool.tier];
  const excess = pool.excessBps;
  const scoreColor =
    pool.score >= 70 ? "var(--yes)" : pool.score >= 50 ? "#c2750a" : "var(--muted)";

  return (
    <a
      href={`https://defillama.com/yields/pool/${pool.id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1.3fr 0.7fr 0.7fr 0.8fr 0.8fr 0.6fr",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--line)",
        padding: "12px 15px",
        fontSize: 13.5,
        transition: ".12s",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
          color: "var(--ink)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            fontWeight: 800,
            color: tierColor,
            flexShrink: 0,
          }}
          title={`Tier ${pool.tier}`}
        >
          {pool.tier}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pool.project}
        </span>
      </span>
      <span
        style={{
          color: "var(--muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {pool.symbol}
      </span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 9.5,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
          textAlign: "right",
        }}
      >
        {pool.yieldType}
      </span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontWeight: 700,
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {pool.apy?.toFixed(2)}%
      </span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 11.5,
          textAlign: "right",
          color: excess > 0 ? "var(--yes)" : "var(--no)",
        }}
      >
        {excess > 0 ? "+" : ""}
        {excess} bps
      </span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 11.5,
          color: "var(--muted)",
          textAlign: "right",
        }}
      >
        {tvlLabel}
      </span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontWeight: 800,
          textAlign: "right",
          color: scoreColor,
        }}
      >
        {pool.score}
      </span>
    </a>
  );
}

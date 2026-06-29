"use client";

import { fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import { useEffect, useMemo, useState } from "react";

/** Tournament opens Jun 11 2026 18:00 UTC. */
const KICKOFF = Date.UTC(2026, 5, 11, 18, 0, 0);

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function diff(now: number): Parts {
  const totalMs = Math.max(0, KICKOFF - now);
  const days = Math.floor(totalMs / 86_400_000);
  const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  return { days, hours, minutes, seconds, totalMs };
}

export function CountdownHero() {
  // Avoid hydration mismatches
  const initial = diff(KICKOFF - 30 * 86_400_000);
  const [parts, setParts] = useState<Parts>(initial);

  useEffect(() => {
    setParts(diff(Date.now()));
    const id = setInterval(() => setParts(diff(Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  // Pull live aggregate stats from the champion category
  const { data } = useWcMarkets({ category: "champion" });
  const totalVolume = useMemo(
    () => (data?.markets ?? []).reduce((s, m) => s + m.volume, 0),
    [data],
  );
  const marketCount = data?.count ?? null;
  const started = parts.totalMs === 0;

  return (
    <section className="ds4 s-hero" aria-label="World Cup 2026">
      {/* background image */}
      <img className="s-hero-bg" src="/brand/heroes/worldcup.jpg" alt="" aria-hidden="true" />

      <div className="s-hero-inner wrap">
        <div className="s-hero-copy">
          <span className="eyebrow">
            <span className="dot-live" aria-hidden="true" />
            World Cup 2026 · markets live
          </span>

          <h1>
            Every market.
            <br />
            <span className="blue">One book.</span>
          </h1>

          <p className="lead">
            48 teams · 104 matches · USA · Canada · Mexico. Binary YES / NO markets settled onchain.
          </p>

          {/* stat chips — live data replaces hardcoded numbers */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 26px" }}>
            {started ? (
              <StatChip value="Live" label="Tournament" />
            ) : (
              <StatChip value={`${parts.days}d ${parts.hours}h`} label="Until kickoff" />
            )}
            {marketCount != null ? (
              <StatChip value={marketCount.toLocaleString()} label="Open markets" />
            ) : (
              <StatChip value="1,000+" label="Open markets" />
            )}
            {totalVolume > 0 ? (
              <StatChip value={fmtVolume(totalVolume)} label="Volume traded" />
            ) : null}
          </div>

          <a className="btn btn-primary" href="#outright">
            Explore all markets
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 8h9M8 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 13,
        padding: "11px 15px",
        boxShadow: "var(--sh-1)",
        minWidth: 104,
      }}
    >
      <div
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 800,
          fontSize: 21,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted-2)",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

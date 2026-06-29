"use client";

/**
 * FX Markets — live rate tape. Wired to the SAME live token universe the
 * desktop Swap desk uses (lib/desks useTokens → /api/tokens). Each row is a
 * real corridor; tapping it opens the live Swap (lib/desks/useSwap) pre-filled,
 * where the real quote is fetched. We do NOT fabricate per-venue gross rates —
 * the venue labels come from each token's real `sources` (FX Provider shown as a
 * neutral venue, same weight as the others).
 */

import { currencyFlag } from "@/lib/desks/currency";
import { useTokens } from "@/lib/desks/hooks";
import type { FxToken } from "@/lib/fx-provider/core/types";
import { useMemo, useState } from "react";
import { Icon } from "../Icon";

const MKT_QUICK = ["USDC", "USDT", "XSGD", "STBL"];

const VENUE_LABEL: Record<string, string> = { "fx-provider": "FX Provider", lifi: "LiFi" };

export function MarketsScreen({ openSwap }: { openSwap: (from: string, to: string) => void }) {
  const [from, setFrom] = useState("USDC");
  const [q, setQ] = useState("");
  const { data: tokens, isLoading } = useTokens();

  const list = tokens ?? [];
  const fromTok = list.find((t) => t.symbol === from);

  const rows = useMemo(() => {
    const f = q.trim().toLowerCase();
    return list
      .filter((t) => t.symbol !== from)
      .filter(
        (t) =>
          !f ||
          t.symbol.toLowerCase().includes(f) ||
          (t.name ?? "").toLowerCase().includes(f) ||
          (t.currency ?? "").toLowerCase().includes(f),
      );
  }, [list, from, q]);

  const quick = MKT_QUICK.filter((s) => list.some((t) => t.symbol === s));

  return (
    <div className="screen">
      <div className="appbar">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            <span className="tick" />
            Live tape
          </div>
          <div className="ab-title">FX Markets</div>
        </div>
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--muted)",
          margin: "0 18px 12px",
          lineHeight: 1.45,
        }}
      >
        Regional stablecoins and their settlement venues. Pick a base, then tap any corridor to open
        it in Swap for a live quote.
      </div>

      <div className="eyebrow-sm" style={{ margin: "0 18px 8px" }}>
        From
      </div>
      <div className="chiprow" style={{ marginBottom: 12 }}>
        {quick.map((s) => {
          const tok = list.find((t) => t.symbol === s);
          return (
            <button
              type="button"
              key={s}
              className={`chip${from === s ? " on" : ""}`}
              onClick={() => setFrom(s)}
            >
              <span style={{ marginRight: 4 }}>
                {currencyFlag(tok?.currency ?? tok?.fiat_currency)}
              </span>
              {s}
            </button>
          );
        })}
      </div>

      <div className="tape-controls">
        <span className="lbl">Filter</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter symbol…" />
      </div>

      <div className="counts">
        <b>{rows.length}</b> corridors from <b>{from}</b>
        {fromTok?.currency ? ` · base ${fromTok.currency}` : ""}
      </div>

      <div className="listwrap">
        {isLoading && (
          <div
            style={{
              textAlign: "center",
              fontFamily: "var(--f-tech)",
              fontSize: 13,
              color: "var(--muted)",
              padding: "40px 0",
            }}
          >
            Loading live token universe…
          </div>
        )}
        {!isLoading &&
          rows.map((t: FxToken) => {
            const venues = (t.sources ?? ["fx-provider"]).map((s) => VENUE_LABEL[s] ?? s);
            return (
              <button
                type="button"
                className="trow"
                key={t.symbol}
                onClick={() => openSwap(from, t.symbol)}
                style={{ width: "100%", textAlign: "left" }}
              >
                <span className="pr-pair">
                  <span className="fl">{currencyFlag(t.currency ?? t.fiat_currency)}</span>
                  <span className="ar">{from} →</span> {t.symbol}
                </span>
                <span className="pr-rates">
                  {t.name ?? t.symbol}
                  {t.currency ? ` · ${t.currency}` : ""}
                </span>
                <span className="pr-best">
                  <span className="bestbadge fx-provider">{venues.join(" · ")} ↗</span>
                </span>
              </button>
            );
          })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 9,
          margin: "16px 18px 6px",
          color: "var(--muted)",
          fontSize: 11.5,
          lineHeight: 1.5,
        }}
      >
        <Icon name="info" size={15} color="var(--brand)" />
        <span>
          Venue labels reflect each corridor&apos;s live settlement sources. Tap a row to open it in
          Swap and fetch a real quote across venues.
        </span>
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

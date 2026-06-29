"use client";

/**
 * components/mobile/earn/VaultsModule.tsx
 * FX Vaults — tappable rows routing to /earn/vaults/[id].
 * Data: /api/p2p/vaults via lib/peer/useP2pVaults (shared module).
 */

import { useP2pVaults } from "@/lib/peer/useP2pVaults";
import Link from "next/link";

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(0)}`;

export function VaultsModule() {
  const { data, isLoading } = useP2pVaults();
  const vaults = (data?.vaults ?? []).filter((v) => v.volumeUsdc >= 100);

  return (
    <div className="emod fade-in">
      <div className="emod-h">
        <h3>FX vaults: delegated market-making</h3>
        <p>
          Delegate USDC to a vault; its rate engine quotes fiat⇄USDC across platforms and you earn
          the realized spread minus the vault fee. Tap a vault to delegate.
        </p>
      </div>
      {isLoading && <div className="subnote">Loading live vaults…</div>}
      {!isLoading && vaults.length === 0 && (
        <div className="subnote">No active vaults right now.</div>
      )}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 12,
        }}
      >
        {vaults.map((v) => (
          <Link
            key={v.id}
            href={`/earn/vaults/${v.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 14px",
              borderBottom: "1px solid var(--line)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--brand)" }}>{v.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Fee {v.feePct.toFixed(2)}% · Delegated {usd(v.delegatedUsdc)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: v.pnlUsd >= 0 ? "var(--yes)" : "var(--no)",
                }}
              >
                {v.pnlUsd >= 0 ? "+" : ""}
                {usd(v.pnlUsd)} PNL
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
                {v.orders.toLocaleString()} orders →
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="subnote" style={{ marginTop: 8 }}>
        Independent managers · past PNL not a promise · 18+ only
      </div>
    </div>
  );
}

"use client";

import type { P2pVault } from "@/app/api/p2p/vaults/route";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

/**
 * FX Vaults — live list of P2P rate-manager vaults (delegate USDC, the vault
 * quotes fiat⇄USDC rates, depositors earn the spread minus the vault fee).
 * Data is live from the protocol indexer via /api/p2p/vaults; every number is
 * real (delegated balance, lifetime volume, realized PNL). Listed alongside
 * Aave/Pendle/HLP — same third-party-product shelf, same honesty bar.
 *
 * Each row links to /earn/vaults/[id] for the full detail + delegation flow.
 */
function useP2pVaults() {
  return useQuery<{ vaults: P2pVault[] }>({
    queryKey: ["p2p", "vaults"],
    queryFn: async () => {
      const res = await fetch("/api/p2p/vaults");
      if (!res.ok) throw new Error(`vaults ${res.status}`);
      return res.json();
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(0)}`;

function VaultRow({ v }: { v: P2pVault }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/earn/vaults/${v.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.7fr 1fr 1fr 1fr 0.7fr",
        gap: 10,
        padding: "13px 16px",
        fontSize: 13.5,
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
        color: "inherit",
        textDecoration: "none",
        background: hovered ? "var(--bg-soft)" : "transparent",
        transition: "background .1s",
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--brand)" }}>{v.name}</span>
      <span style={{ fontFamily: "var(--f-tech)" }}>{v.feePct.toFixed(2)}%</span>
      <span style={{ fontFamily: "var(--f-tech)" }}>{usd(v.delegatedUsdc)}</span>
      <span style={{ fontFamily: "var(--f-tech)" }}>{usd(v.volumeUsdc)}</span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          color: v.pnlUsd >= 0 ? "var(--yes)" : "var(--no)",
        }}
      >
        {v.pnlUsd >= 0 ? "+" : ""}
        {usd(v.pnlUsd)}
      </span>
      <span style={{ fontFamily: "var(--f-tech)", textAlign: "right" }}>
        {v.orders.toLocaleString()}
      </span>
    </Link>
  );
}

export function VaultsSection() {
  const { data, isLoading } = useP2pVaults();
  // Show vaults with real traction; dust/test vaults stay hidden.
  const vaults = (data?.vaults ?? []).filter((v) => v.volumeUsdc >= 100);

  return (
    <section className="card" style={{ padding: 22, marginTop: 24, marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 19 }}>FX vaults: delegated market-making</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 620 }}>
            Delegate USDC to a vault and its rate engine quotes fiat⇄USDC across platforms; you earn
            the realized spread minus the vault fee. Run by independent managers. Volume and PNL
            below are live lifetime figures, not projections.
          </p>
        </div>
        <Link href="/cash" className="btn btn-ghost" style={{ flexShrink: 0 }}>
          P2P desk →
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.7fr 1fr 1fr 1fr 0.7fr",
            gap: 10,
            padding: "10px 16px",
            fontFamily: "var(--f-tech)",
            fontSize: 10.5,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>Vault</span>
          <span>Fee</span>
          <span>Delegated</span>
          <span>Lifetime volume</span>
          <span>Realized PNL</span>
          <span style={{ textAlign: "right" }}>Orders</span>
        </div>
        {isLoading && (
          <div style={{ padding: 18, fontSize: 13, color: "var(--muted-2)" }}>
            Loading live vaults…
          </div>
        )}
        {!isLoading && vaults.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: "var(--muted-2)" }}>
            No active vaults right now.
          </div>
        )}
        {vaults.map((v) => (
          <VaultRow key={v.id} v={v} />
        ))}
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "var(--muted-2)" }}>
        Vault managers are independent third parties; past PNL is not a promise. Click a vault to
        see daily charts and delegate an existing deposit. 18+ only.
      </p>
    </section>
  );
}

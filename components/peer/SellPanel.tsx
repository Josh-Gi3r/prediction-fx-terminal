"use client";

/**
 * SellPanel — Peer-parity advanced Sell layout (two-column centered card).
 *
 * Left column:  Deposit Amount · multi-platform list with per-platform
 *               payment-ID + fiat currencies + rate.
 * Right column: Advanced settings (toggled) — Private Orderbook (whitelist
 *               hook), Delegate to Vault, Order Limits, Retain on Empty.
 *
 * All createDeposit params verified against the SDK type:
 *   processorNames[]  ✓ real
 *   payeeData[]       ✓ real
 *   conversionRates[][] ✓ real
 *   intentAmountRange  ✓ real
 *   retainOnEmpty      ✓ real
 *   delegate           ✓ real
 *   Private orderbook  ✓ real — createDeposit has no taker-allowlist param;
 *                        the protocol gates takers with a single on-chain
 *                        whitelist-*hook contract*, so we collect that hook
 *                        address and submit it via client.setDepositWhitelistHook
 *                        as a real post-deposit transaction.
 *
 * Flow:
 *   1. ensureAllowance (exact-amount, maxApprove:false)
 *   2. createDeposit  (multi-platform, intentAmountRange, retainOnEmpty)
 *   3. (optional) setDepositWhitelistHook  (private orderbook gate)
 *   4. (optional) setRateManager delegation
 *   5. trackPeerDeposit + toast
 */

import React from "react";

import type { P2pVault } from "@/app/api/p2p/vaults/route";
import { usePeerClient } from "@/lib/peer/client";
import { PEER_PAYMENT_PLATFORMS } from "@/lib/peer/config";
import { useCreateDeposit } from "@/lib/peer/useCreateDeposit";
import { useP2pVaults } from "@/lib/peer/useP2pVaults";
import { useSearchParams } from "next/navigation";
import { AdvancedPanel } from "./sell/AdvancedPanel";
import { PlatformList } from "./sell/PlatformList";
import { SummaryRow } from "./sell/primitives";
import { type AdvancedSettings, type PlatformEntry, newPlatformEntry } from "./sell/types";

function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function SellPanel() {
  const client = usePeerClient();
  const searchParams = useSearchParams();

  const preselectedVaultParam = searchParams?.get("vault") ?? null;
  const { data: vaultData } = useP2pVaults();

  const preselectedVaultId = React.useMemo(() => {
    if (!preselectedVaultParam) return null;
    const vaults = vaultData?.vaults ?? [];
    return (
      vaults.find((v) => v.rateManagerId === preselectedVaultParam)?.id ??
      vaults.find((v) => v.id === preselectedVaultParam)?.id ??
      null
    );
  }, [preselectedVaultParam, vaultData]);

  // ── core state ────────────────────────────────────────────────────────────
  const [usdcAmount, setUsdcAmount] = React.useState("500");
  const [platforms, setPlatforms] = React.useState<PlatformEntry[]>(() => {
    const first = PEER_PAYMENT_PLATFORMS[0];
    return first ? [newPlatformEntry(first)] : [];
  });

  // ── advanced toggle + settings ────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = React.useState(true);
  const [advanced, setAdvanced] = React.useState<AdvancedSettings>({
    whitelistEnabled: false,
    whitelistHook: "",
    delegateEnabled: preselectedVaultParam != null,
    selectedVaultId: null,
    delegateTab: "volume",
    minOrder: "10",
    maxOrder: "500",
    retainOnEmpty: false,
  });

  // Apply ?vault= deep-link once data loads
  React.useEffect(() => {
    if (preselectedVaultId !== null) {
      setAdvanced((prev) => ({
        ...prev,
        delegateEnabled: true,
        selectedVaultId: preselectedVaultId,
      }));
      setShowAdvanced(true);
    }
  }, [preselectedVaultId]);

  // Sync maxOrder to usdcAmount as a convenience default, only when maxOrder
  // hasn't been manually changed beyond the initial "500".
  const maxOrderTouchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!maxOrderTouchedRef.current) {
      setAdvanced((prev) => ({ ...prev, maxOrder: usdcAmount || "500" }));
    }
  }, [usdcAmount]);

  // Wrap the advanced onChange so a manual maxOrder edit marks the field as
  // "touched" — this stops the usdcAmount sync effect above from continuously
  // overwriting the user's value.
  const handleAdvancedChange = React.useCallback((next: AdvancedSettings) => {
    setAdvanced((prev) => {
      if (next.maxOrder !== prev.maxOrder) {
        maxOrderTouchedRef.current = true;
      }
      return next;
    });
  }, []);

  // ── platform list helpers ─────────────────────────────────────────────────
  function updatePlatform(id: string, updated: PlatformEntry) {
    setPlatforms((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }
  function removePlatform(id: string) {
    setPlatforms((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
  }
  function addPlatform(p: (typeof PEER_PAYMENT_PLATFORMS)[number]) {
    setPlatforms((prev) => [...prev, newPlatformEntry(p)]);
  }

  // ── submission ────────────────────────────────────────────────────────────
  const { btnState, isPending, handleSubmit } = useCreateDeposit();

  const selectedVault = React.useMemo((): P2pVault | null => {
    if (!advanced.delegateEnabled || !advanced.selectedVaultId) return null;
    return vaultData?.vaults.find((v) => v.id === advanced.selectedVaultId) ?? null;
  }, [advanced.delegateEnabled, advanced.selectedVaultId, vaultData]);

  const ctaLabel = () => {
    if (!client) return "Connect wallet (Base)";
    switch (btnState) {
      case "approving":
        return "Approving USDC…";
      case "creating":
        return "Creating deposit…";
      case "whitelisting":
        return "Attaching whitelist hook…";
      case "delegating":
        return "Setting vault delegation…";
      default:
        return "Review Deposit";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showAdvanced
            ? "repeat(auto-fit, minmax(min(100%, 320px), 1fr))"
            : "1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* header: SELL label + Advanced toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--brand)",
              }}
            >
              Sell
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: showAdvanced ? "var(--bg-tint)" : "none",
                border: showAdvanced ? "1.5px solid var(--brand)" : "1.5px solid var(--line)",
                borderRadius: 8,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: showAdvanced ? "var(--brand)" : "var(--muted-2)",
                transition: ".12s",
              }}
            >
              Advanced
              <span style={{ fontSize: 9 }}>{showAdvanced ? "▲" : "▼"}</span>
            </button>
          </div>

          {/* Deposit Amount */}
          <div className="panel">
            <div className="pl">
              <span>Deposit Amount</span>
              <span style={{ fontFamily: "var(--f-tech)", fontSize: 11, color: "var(--muted-2)" }}>
                Balance: —
              </span>
            </div>
            <div className="prow">
              <input
                type="text"
                inputMode="decimal"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(sanitizeDecimal(e.target.value))}
                placeholder="500"
                aria-label="USDC deposit amount"
              />
              <button
                type="button"
                className="tokbtn"
                style={{ cursor: "default", pointerEvents: "none" }}
              >
                USDC
              </button>
            </div>
            <div className="subbal">
              Min: {advanced.minOrder || "10"} USDC · Max: {advanced.maxOrder || usdcAmount || "—"}{" "}
              USDC
            </div>
          </div>

          <PlatformList
            platforms={platforms}
            onUpdate={updatePlatform}
            onRemove={removePlatform}
            onAdd={addPlatform}
          />

          {/* Summary */}
          <div className="brk">
            <SummaryRow label="You lock" value={`${usdcAmount || "—"} USDC (Base mainnet)`} />
            <SummaryRow
              label="Platforms"
              value={platforms.map((e) => e.platform.displayName).join(", ")}
            />
            <SummaryRow
              label="Order range"
              value={`${advanced.minOrder || "10"} – ${advanced.maxOrder || usdcAmount || "—"} USDC`}
            />
            {advanced.retainOnEmpty && <SummaryRow label="Retain on empty" value="Yes" green />}
            {selectedVault && (
              <SummaryRow
                label="Rate vault"
                value={`${selectedVault.name} (${selectedVault.feePct.toFixed(2)}% fee)`}
              />
            )}
            {advanced.whitelistEnabled && advanced.whitelistHook.trim() !== "" && (
              <SummaryRow
                label="Private orderbook"
                value={`Hook ${advanced.whitelistHook.trim().slice(0, 6)}…${advanced.whitelistHook.trim().slice(-4)} (post-deposit tx)`}
              />
            )}
          </div>

          {/* CTA */}
          <button
            type="button"
            className="cta"
            onClick={() =>
              handleSubmit({
                usdcAmount,
                platforms,
                advanced,
                selectedVault,
                onSuccess: (resetPlatform) => {
                  setUsdcAmount("500");
                  setPlatforms([resetPlatform]);
                  setAdvanced((prev) => ({
                    ...prev,
                    whitelistEnabled: false,
                    whitelistHook: "",
                    retainOnEmpty: false,
                  }));
                },
              })
            }
            disabled={isPending || !client}
          >
            {ctaLabel()}
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted-2)", margin: 0 }}>
            USDC escrowed on Base · released on proof of fiat payment
          </p>
        </div>

        {/* ── RIGHT COLUMN (Advanced) ── */}
        {showAdvanced && (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
                marginBottom: 12,
              }}
            >
              Advanced Settings
            </div>
            <AdvancedPanel settings={advanced} onChange={handleAdvancedChange} />
          </div>
        )}
      </div>
    </div>
  );
}

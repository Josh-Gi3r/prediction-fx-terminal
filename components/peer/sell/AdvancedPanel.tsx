"use client";

/**
 * components/peer/sell/AdvancedPanel.tsx
 *
 * Right-column advanced settings: Private Orderbook (whitelist hook),
 * Delegate to Vault, Order Limits, Retain on Empty.
 */

import React from "react";

import { useP2pVaults } from "@/lib/peer/useP2pVaults";
import { isAddress } from "viem";
import { SectionLabel, Toggle, techLabel } from "./primitives";
import type { AdvancedSettings } from "./types";

function sanitizeUsdc(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function VaultRow({
  label,
  sub,
  selected,
  onSelect,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 12px",
        border: `1.5px solid ${selected ? "var(--brand)" : "var(--line)"}`,
        borderRadius: 10,
        background: selected ? "var(--bg-tint)" : "#fff",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 1 }}>{sub}</div>
      </div>
      <div
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: `2px solid ${selected ? "var(--brand)" : "var(--line-2)"}`,
          background: selected ? "var(--brand)" : "transparent",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

export function AdvancedPanel({
  settings,
  onChange,
}: {
  settings: AdvancedSettings;
  onChange: (s: AdvancedSettings) => void;
}) {
  const { data: vaultData, isLoading: vaultsLoading } = useP2pVaults();
  const vaults = (vaultData?.vaults ?? []).filter((v) => v.volumeUsdc >= 100);

  function set<K extends keyof AdvancedSettings>(key: K, val: AdvancedSettings[K]) {
    onChange({ ...settings, [key]: val });
  }

  const hookTrimmed = settings.whitelistHook.trim();
  const hookValid = hookTrimmed === "" || isAddress(hookTrimmed);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      {/* ── Private orderbook (whitelist hook) ── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 13,
          background: "#fff",
          padding: "14px 16px",
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
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              Private Orderbook
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
              Gate takers with a whitelist hook
            </div>
          </div>
          <Toggle
            enabled={settings.whitelistEnabled}
            onChange={(v) => set("whitelistEnabled", v)}
          />
        </div>

        {settings.whitelistEnabled && (
          <>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted-2)",
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "7px 10px",
                lineHeight: 1.55,
                marginBottom: 10,
              }}
            >
              The protocol enforces private orderbooks with an onchain whitelist-hook contract.
              Paste your deployed hook address. It attaches to this deposit via a second transaction
              (
              <code style={{ fontFamily: "var(--f-tech)", fontSize: 10 }}>
                setDepositWhitelistHook
              </code>
              ) right after it goes live.
            </div>

            {techLabel("Whitelist hook contract")}
            <input
              type="text"
              value={settings.whitelistHook}
              onChange={(e) => set("whitelistHook", e.target.value)}
              placeholder="0x… hook contract address"
              aria-label="Whitelist hook contract address"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${hookValid ? "var(--line)" : "var(--no)"}`,
                borderRadius: 9,
                padding: "8px 11px",
                fontFamily: "var(--f-tech)",
                fontSize: 12,
                color: "var(--ink)",
                background: "var(--bg-soft)",
                outline: "none",
              }}
            />
            {!hookValid && (
              <div style={{ fontSize: 10, color: "var(--no)", marginTop: 5 }}>
                Not a valid contract address.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delegate to Vault ── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 13,
          background: "#fff",
          padding: "14px 16px",
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
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              Delegate to Vault
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>
              Automated rate management
            </div>
          </div>
          <Toggle enabled={settings.delegateEnabled} onChange={(v) => set("delegateEnabled", v)} />
        </div>

        {settings.delegateEnabled && (
          <>
            {/* sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {(["volume", "apr"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => set("delegateTab", tab)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 7,
                    border:
                      settings.delegateTab === tab
                        ? "1.5px solid var(--brand)"
                        : "1.5px solid var(--line)",
                    background: settings.delegateTab === tab ? "var(--bg-tint)" : "#fff",
                    color: settings.delegateTab === tab ? "var(--brand)" : "var(--muted)",
                    fontFamily: "var(--f-tech)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {vaultsLoading && (
              <div style={{ fontSize: 12, color: "var(--muted-2)", padding: "6px 0" }}>
                Loading vaults…
              </div>
            )}

            {!vaultsLoading && vaults.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted-2)" }}>No active vaults.</div>
            )}

            {!vaultsLoading &&
              vaults.length > 0 &&
              (() => {
                const sorted =
                  settings.delegateTab === "apr"
                    ? [...vaults].sort((a, b) => b.feePct - a.feePct)
                    : [...vaults].sort((a, b) => b.volumeUsdc - a.volumeUsdc);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <VaultRow
                      label="Self-managed"
                      sub="Set rates manually"
                      selected={settings.selectedVaultId === null}
                      onSelect={() => set("selectedVaultId", null)}
                    />
                    {sorted.map((v) => (
                      <VaultRow
                        key={v.id}
                        label={v.name}
                        sub={`${v.feePct.toFixed(2)}% fee · $${
                          v.volumeUsdc >= 1000
                            ? `${(v.volumeUsdc / 1000).toFixed(1)}K`
                            : v.volumeUsdc.toFixed(0)
                        } vol`}
                        selected={settings.selectedVaultId === v.id}
                        onSelect={() => set("selectedVaultId", v.id)}
                      />
                    ))}
                  </div>
                );
              })()}
          </>
        )}
      </div>

      {/* ── Order Limits ── (wired to createDeposit intentAmountRange) */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 13,
          background: "#fff",
          padding: "14px 16px",
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <SectionLabel>Order Limits</SectionLabel>
          <div style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
            Min and max USDC per taker order. Maps to{" "}
            <code style={{ fontFamily: "var(--f-tech)", fontSize: 10 }}>intentAmountRange</code>{" "}
            onchain.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            {techLabel("Min per order")}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "1px solid var(--line)",
                borderRadius: 9,
                padding: "8px 11px",
                background: "var(--bg-soft)",
              }}
            >
              <input
                type="text"
                inputMode="decimal"
                value={settings.minOrder}
                onChange={(e) => set("minOrder", sanitizeUsdc(e.target.value))}
                aria-label="Min order USDC"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  outline: "none",
                  fontFamily: "var(--f-display)",
                }}
              />
              <span style={{ fontSize: 10, color: "var(--muted-2)", fontFamily: "var(--f-tech)" }}>
                USDC
              </span>
            </div>
          </div>
          <div>
            {techLabel("Max per order")}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "1px solid var(--line)",
                borderRadius: 9,
                padding: "8px 11px",
                background: "var(--bg-soft)",
              }}
            >
              <input
                type="text"
                inputMode="decimal"
                value={settings.maxOrder}
                onChange={(e) => set("maxOrder", sanitizeUsdc(e.target.value))}
                aria-label="Max order USDC"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  outline: "none",
                  fontFamily: "var(--f-display)",
                }}
              />
              <span style={{ fontSize: 10, color: "var(--muted-2)", fontFamily: "var(--f-tech)" }}>
                USDC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Retain on Empty ── (wired to createDeposit retainOnEmpty) */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 13,
          background: "#fff",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            Retain on Empty
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
            When enabled, your deposit configuration (platform, currencies, rate) stays live even
            after the USDC balance reaches zero. Maps to{" "}
            <code style={{ fontFamily: "var(--f-tech)", fontSize: 10 }}>retainOnEmpty</code>{" "}
            onchain.
          </div>
        </div>
        <Toggle enabled={settings.retainOnEmpty} onChange={(v) => set("retainOnEmpty", v)} />
      </div>
    </div>
  );
}

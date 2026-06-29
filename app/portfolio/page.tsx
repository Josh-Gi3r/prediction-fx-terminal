"use client";

import "./portfolio.css";
import { MultiChainWallet } from "@/components/portfolio/MultiChainWallet";
import { SendModal } from "@/components/portfolio/SendModal";
import { Nav } from "@/components/shared/Nav";
import { Skeleton } from "@/components/ui/skeleton";
import { FundWalletModal } from "@/components/wc/FundWalletModal";
import { PmBetsSection } from "@/components/wc/PmBetsSection";
import { useAaveBalances, useAaveReserves } from "@/lib/desks/aaveHooks";
import { useConfig, useTokens } from "@/lib/desks/hooks";
import { type StoredVlBatch, getVlBatches } from "@/lib/desks/vlStore";
import { useMultiChainBalances } from "@/lib/portfolio/chains";
import { TRANSFER_TOKENS, type TransferToken } from "@/lib/privy/transfer";
import { fmtToken, fmtUsd, fromRaw } from "@/lib/fx-provider/core/format";
import { FX_VAULT_ABI, type FxToken } from "@/lib/fx-provider/core/types";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";

// ─── Feature flag ─────────────────────────────────────────────────────────────
const GASLESS_SEND_ENABLED = process.env.NEXT_PUBLIC_FEATURE_GASLESS_SEND === "true";

// ─── helpers ─────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── stat tile ────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string | null;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="pf-tile">
      <div className="l">
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 2,
            background: "var(--accent)",
            borderRadius: 2,
          }}
        />
        {label}
      </div>
      <div className="v">
        {loading || value === null ? <Skeleton className="h-8 w-24 mt-2" /> : value}
      </div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

// ─── idle balances table ──────────────────────────────────────────────────────

function IdleBalancesSection({
  positions,
  loading,
}: {
  positions: Array<{ token: FxToken; raw: bigint; human: number }>;
  loading: boolean;
}) {
  return (
    <div className="pf-card">
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            Trading vault
          </div>
          <h3 style={{ marginTop: 4 }}>Idle balances</h3>
        </div>
        <span className="right">ready to swap or make markets</span>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="pf-empty">No idle vault balances. Deposit tokens to start trading.</div>
      ) : (
        <div className="ptbl">
          <div className="hd" style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}>
            <div>Token</div>
            <div>Currency</div>
            <div className="r">Balance</div>
          </div>
          {positions.map((p) => (
            <div
              key={p.token.address}
              className="rw"
              style={{ gridTemplateColumns: "1.5fr 1fr 1fr" }}
            >
              <div className="tk">
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--bg-tint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--f-tech)",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--brand)",
                    flexShrink: 0,
                  }}
                >
                  {p.token.symbol.slice(0, 4)}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.token.symbol}</div>
                </div>
              </div>
              <span style={{ fontSize: 13, color: "var(--muted)", alignSelf: "center" }}>
                {p.token.currency ?? "—"}
              </span>
              <span
                className="amt"
                style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--f-tech)" }}
              >
                {fmtToken(p.human)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── aave supplies table ──────────────────────────────────────────────────────

function AaveSection({
  positions,
}: {
  positions: Array<{
    reserve: { symbol: string; apyPct: number; decimals: number };
    raw: bigint;
    human: number;
  }>;
}) {
  return (
    <div className="pf-card">
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            Aave v3 supplies
          </div>
          <h3 style={{ marginTop: 4 }}>Earning live APY</h3>
        </div>
        <span className="right">aTokens accrue in real time</span>
      </div>
      {positions.length === 0 ? (
        <div className="pf-empty">
          No Aave supplies.{" "}
          <a href="/earn" style={{ color: "var(--brand)", fontWeight: 700 }}>
            Supply from the Earn tab.
          </a>
        </div>
      ) : (
        <div className="ptbl">
          <div className="hd" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div>Asset</div>
            <div>APY</div>
            <div className="r">Supplied</div>
          </div>
          {positions.map((p) => (
            <div
              key={p.reserve.symbol}
              className="rw"
              style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
            >
              <div className="tk">
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--bg-tint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--f-tech)",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--brand)",
                    flexShrink: 0,
                  }}
                >
                  {p.reserve.symbol.slice(0, 4)}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.reserve.symbol}</span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  color: "var(--yes)",
                  alignSelf: "center",
                }}
              >
                {p.reserve.apyPct.toFixed(2)}%
              </span>
              <span
                className="amt"
                style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--f-tech)" }}
              >
                {fmtToken(p.human)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── vl batches ──────────────────────────────────────────────────────────────

function VlBatchesSection({ batches }: { batches: StoredVlBatch[] }) {
  return (
    <div className="pf-card">
      <div className="ch">
        <div>
          <div className="eyebrow">
            <span className="tick" />
            Virtual Liquidity
          </div>
          <h3 style={{ marginTop: 4 }}>Active maker batches</h3>
        </div>
        <span className="right">one budget, many FX corridors</span>
      </div>
      {batches.length === 0 ? (
        <div className="pf-empty">
          No active VL batches. Post one from the{" "}
          <a href="/earn" style={{ color: "var(--brand)", fontWeight: 700 }}>
            Earn
          </a>{" "}
          tab: pick corridors, set a spread, sign once.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {batches.map((b) => (
            <div
              key={b.vlBatchId}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "13px 15px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                >
                  {b.vlBatchId.slice(0, 14)}…
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {b.amount} {b.budgetSymbol} · {b.legs.length} legs
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "var(--muted-2)",
          lineHeight: 1.55,
        }}
      >
        Batches are tracked client-side (the venue&apos;s order listing returns empty). Cancel signs
        a CancelVLBatch struct. Only your wallet can cancel your batch.
      </p>
    </div>
  );
}

// ─── disconnected demo data ───────────────────────────────────────────────────

const DEMO_VAULT: Array<{ token: FxToken; raw: bigint; human: number }> = [
  { symbol: "XSGD", currency: "SGD", human: 18420.5 },
  { symbol: "USDC", currency: "USD", human: 12650.0 },
  { symbol: "USDT", currency: "USD", human: 9310.75 },
  { symbol: "STBL", currency: "MYR", human: 41200.0 },
  { symbol: "BRLV", currency: "BRL", human: 7740.25 },
].map((t, i) => ({
  token: { symbol: t.symbol, currency: t.currency, address: `0xDEMO${i}` } as FxToken,
  raw: 0n,
  human: t.human,
}));

const DEMO_AAVE: Array<{
  reserve: { symbol: string; apyPct: number; decimals: number };
  raw: bigint;
  human: number;
}> = [
  { reserve: { symbol: "USDC", apyPct: 4.82, decimals: 6 }, raw: 0n, human: 24500.0 },
  { reserve: { symbol: "USDT", apyPct: 4.31, decimals: 6 }, raw: 0n, human: 15800.0 },
  { reserve: { symbol: "WETH", apyPct: 1.95, decimals: 18 }, raw: 0n, human: 6.42 },
];

const DEMO_BATCHES: StoredVlBatch[] = [
  {
    vlBatchId: "0x9f4c2a8b71e3d0c5",
    amount: "25000",
    budgetSymbol: "USDC",
    legs: [{}, {}, {}, {}],
  } as unknown as StoredVlBatch,
  {
    vlBatchId: "0x3d81fb6042a9c7e1",
    amount: "12000",
    budgetSymbol: "XSGD",
    legs: [{}, {}],
  } as unknown as StoredVlBatch,
];

const DEMO_VAULT_TOTAL = 89321;
const DEMO_AAVE_TOTAL = 60622;

// ─── disconnected state ───────────────────────────────────────────────────────

function DisconnectedState() {
  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <section className="s-hero" style={{ minHeight: 420 }}>
        <img
          className="s-hero-bg"
          src="/brand/heroes/portfolio.jpg"
          alt=""
          style={{ objectPosition: "60% 40%" }}
        />
        <div className="wrap s-hero-inner" style={{ minHeight: 420 }}>
          <div className="s-hero-copy">
            <span className="eyebrow">
              <span className="tick" />
              Portfolio · non-custodial
            </span>
            <h1>
              Everything you hold,
              <br />
              <span className="blue">on one page.</span>
            </h1>
            <p className="lead" style={{ marginBottom: 0 }}>
              Your balances, your yield, your open positions. One page, read live from the chain.
              Nothing here can move your funds.
            </p>
          </div>
        </div>
      </section>

      <div className="pf-preview">
        <div className="pf-preview-demo" aria-hidden="true">
          <div className="wrap pf-wrap">
            <div className="pf-bar">
              <div className="who">
                <div className="addr">
                  <span className="dot" />
                  <span className="a">0x71C7…3eF9</span>
                  <span className="net">· connected</span>
                </div>
              </div>
              <span className="ro">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M7 1.3l4.5 2v3c0 3-2 4.6-4.5 5.8C4.5 10.9 2.5 9.3 2.5 6.3v-3z"
                    stroke="var(--accent-2)"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>
                Read-only · non-custodial
              </span>
            </div>

            <div className="pf-tiles">
              <KpiTile
                label="Trading vault"
                value={fmtUsd(DEMO_VAULT_TOTAL)}
                sub={`${DEMO_VAULT.length} assets idle`}
              />
              <KpiTile
                label="Aave supplied"
                value={fmtUsd(DEMO_AAVE_TOTAL)}
                sub={`${DEMO_AAVE.length} positions`}
              />
              <KpiTile
                label="Active VL batches"
                value={`${DEMO_BATCHES.length}`}
                sub="maker offers live"
              />
            </div>

            <IdleBalancesSection positions={DEMO_VAULT} loading={false} />
            <AaveSection positions={DEMO_AAVE} />
            <VlBatchesSection batches={DEMO_BATCHES} />
          </div>
        </div>

        <div className="pf-preview-scrim" aria-hidden="true" />

        <div className="pf-preview-card-wrap">
          <div className="pf-connect-card">
            <span className="pf-preview-tag">Preview · sample data</span>
            <div className="pf-connect-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <rect
                  x="2"
                  y="7"
                  width="22"
                  height="14"
                  rx="3"
                  stroke="var(--brand)"
                  strokeWidth="1.6"
                />
                <path d="M18 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="var(--brand)" />
                <path d="M2 11h22" stroke="var(--brand)" strokeWidth="1.6" />
              </svg>
            </div>
            <h3 style={{ fontSize: 22, marginBottom: 10 }}>Connect your wallet</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 6px", lineHeight: 1.6 }}>
              Connect to see your balances, yield and open positions, read live from the chain.
            </p>
            <p
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 12,
                color: "var(--muted-2)",
                margin: "10px 0 0",
              }}
            >
              Non-custodial · read-only · your keys stay with you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  // Multi-chain wallet balances — called unconditionally (hooks rules).
  // When address is undefined (not connected) the hook returns zero state.
  const { totalUsd: walletTotalUsd, anyLoading: walletLoading } = useMultiChainBalances(
    address as `0x${string}` | undefined,
  );
  const { data: tokens } = useTokens();
  const { data: config } = useConfig();
  const vault = (config?.vault_address ??
    "0xC7d4Fd2638e6630C8C61329878676b88A8A24D43") as `0x${string}`;

  const tokenList = tokens ?? [];

  const { data: vaultRaws, isLoading: vaultLoading } = useReadContracts({
    allowFailure: true,
    contracts: tokenList.map((t) => ({
      address: vault,
      abi: FX_VAULT_ABI,
      functionName: "balanceOf" as const,
      args: [t.address as `0x${string}`, address as `0x${string}`],
    })),
    query: { enabled: !!address && tokenList.length > 0, refetchInterval: 30_000 },
  });

  const fxVault = useMemo(() => {
    if (!vaultRaws) return [];
    return tokenList
      .map((t, i) => {
        const r = vaultRaws[i];
        if (r?.status !== "success" || typeof r.result !== "bigint" || r.result === 0n) return null;
        const human = Number(fromRaw(r.result, t.decimals));
        return { token: t, raw: r.result, human };
      })
      .filter((x): x is { token: FxToken; raw: bigint; human: number } => !!x)
      .sort((a, b) => b.human - a.human);
  }, [vaultRaws, tokenList]);

  const { reserves } = useAaveReserves();
  const { balances: aaveBalances } = useAaveBalances(address);
  const aavePositions = useMemo(
    () =>
      reserves
        .map((r) => {
          const raw = aaveBalances[r.symbol];
          if (!raw || raw === 0n) return null;
          return { reserve: r, raw, human: Number(fromRaw(raw, r.decimals)) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.human - a.human),
    [reserves, aaveBalances],
  );

  const [batches, setBatches] = useState<StoredVlBatch[]>([]);
  const [addrCopied, setAddrCopied] = useState(false);
  useEffect(() => {
    setBatches(getVlBatches(address));
  }, [address]);

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [sendModal, setSendModal] = useState<{
    open: boolean;
    symbol: string;
    token: TransferToken;
    max: number;
  } | null>(null);

  const [bridgeOpen, setBridgeOpen] = useState(false);

  if (!isConnected) return <DisconnectedState />;

  const fxVaultTotal = fxVault.reduce((s, r) => s + r.human, 0);
  const aaveTotal = aavePositions.reduce((s, r) => s + r.human, 0);

  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* hero */}
      <section className="s-hero" style={{ minHeight: 420 }}>
        <img
          className="s-hero-bg"
          src="/brand/heroes/portfolio.jpg"
          alt=""
          style={{ objectPosition: "60% 40%" }}
        />
        <div className="wrap s-hero-inner" style={{ minHeight: 420 }}>
          <div className="s-hero-copy">
            <span className="eyebrow">
              <span className="tick" />
              Portfolio · non-custodial
            </span>
            <h1>
              Everything you hold,
              <br />
              <span className="blue">on one page.</span>
            </h1>
            <p className="lead" style={{ marginBottom: 0 }}>
              Your balances, your yield, your open positions. One page, read live from the chain.
              Nothing here can move your funds.
            </p>
          </div>
        </div>
      </section>

      {/* dashboard */}
      <div className="wrap pf-wrap">
        {/* wallet bar */}
        <div className="pf-bar">
          <div className="who">
            {address && (
              <button
                type="button"
                className="addr"
                style={{ cursor: "pointer", background: "none", border: 0, font: "inherit" }}
                title="Copy address"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address);
                    setAddrCopied(true);
                    setTimeout(() => setAddrCopied(false), 1500);
                  } catch {}
                }}
              >
                <span className="dot" />
                <span className="a">{shortAddr(address)}</span>
                <span className="net">{addrCopied ? "· copied ✓" : "· tap to copy"}</span>
              </button>
            )}
          </div>
          <span className="ro">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 1.3l4.5 2v3c0 3-2 4.6-4.5 5.8C4.5 10.9 2.5 9.3 2.5 6.3v-3z"
                stroke="var(--accent-2)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
            Read-only · non-custodial
          </span>
        </div>

        {/* summary tiles */}
        <div className="pf-tiles">
          <KpiTile
            label="In your wallet"
            value={walletLoading ? null : fmtUsd(walletTotalUsd)}
            sub="Ethereum + Polygon + Base"
            loading={walletLoading}
          />
          <KpiTile
            label="Trading vault"
            value={vaultLoading ? null : fmtUsd(fxVaultTotal)}
            sub={`${fxVault.length} asset${fxVault.length !== 1 ? "s" : ""} idle`}
            loading={vaultLoading}
          />
          <KpiTile
            label="Aave supplied"
            value={fmtUsd(aaveTotal)}
            sub={
              aavePositions.length > 0
                ? `${aavePositions.length} position${aavePositions.length !== 1 ? "s" : ""}`
                : "none supplied"
            }
          />
          <KpiTile
            label="Active VL batches"
            value={`${batches.length}`}
            sub={batches.length > 0 ? "maker offers live" : "no active batches"}
          />
        </div>

        {/* Multi-chain wallet area */}
        {address && (
          <MultiChainWallet
            address={address}
            onBridge={() => setBridgeOpen(true)}
            onSend={(symbol, token, max) => {
              const tokenLower = symbol.toLowerCase() as TransferToken;
              if ((TRANSFER_TOKENS as readonly string[]).includes(tokenLower)) {
                setSendModal({ open: true, symbol, token: tokenLower, max });
              }
            }}
            sendEnabled={GASLESS_SEND_ENABLED}
          />
        )}

        {/* settlement vault idle balances */}
        <IdleBalancesSection positions={fxVault} loading={vaultLoading} />

        {/* Aave v3 supplies */}
        <AaveSection positions={aavePositions} />

        {/* VL batches */}
        <VlBatchesSection batches={batches} />

        {/* Prediction market bets (Polymarket) */}
        <PmBetsSection />

        {/* foot note */}
        <div className="pf-foot-note">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1.4l5 2.2v3.3c0 3.3-2.3 5-5 6.5-2.7-1.5-5-3.2-5-6.5V3.6z"
              stroke="var(--brand)"
              strokeWidth="1.3"
              fill="none"
            />
            <path
              d="M5.8 8l1.6 1.6L10.6 6.2"
              stroke="var(--brand)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          This app never moves your funds. This page only reads onchain state.
        </div>
      </div>

      {/* Bridge modal */}
      <FundWalletModal open={bridgeOpen} onClose={() => setBridgeOpen(false)} />

      {/* Send modal */}
      {GASLESS_SEND_ENABLED && sendModal && (
        <SendModal
          open={sendModal.open}
          onClose={() => setSendModal(null)}
          tokenSymbol={sendModal.symbol}
          token={sendModal.token}
          maxBalance={sendModal.max}
        />
      )}
    </div>
  );
}

import type React from "react";

"use client";

/**
 * components/mobile/p2p/ActivityPanel.tsx
 * Activity tab — live deposits + intents from intentStore + on-chain reads.
 *
 * Same data sources as components/peer/ActivityPanel.tsx (desktop):
 *   - listPeerDeposits / listPeerIntents  -> localStorage-tracked records
 *   - client.getAccountDeposits(address) -> on-chain live state via Zkp2pClient
 * No static mock data; honest empty state when disconnected or no activity.
 */

import { usePeerClient } from "@/lib/peer/client";
import { PEER_INTENT_ACTIVE, baseUnitsToUsdc } from "@/lib/peer/config";
import {
  type TrackedPeerDeposit,
  type TrackedPeerIntent,
  listPeerDeposits,
  listPeerIntents,
} from "@/lib/peer/intentStore";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { PlatBadge, card, platDisplayName } from "./shared";

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

interface LiveDeposit {
  depositId: string;
  availableLiquidity: string;
  acceptingIntents: boolean;
}

// ── sub-components ────────────────────────────────────────────────────────────

function DepositCard({
  local,
  live,
}: {
  local: TrackedPeerDeposit;
  live: LiveDeposit | undefined;
  liveRates: Record<string, number | null>;
  ratesLoading: Record<string, boolean>;
}) {
  const accepting = live ? live.acceptingIntents : local.status === "active";
  const available = live
    ? Number(baseUnitsToUsdc(BigInt(live.availableLiquidity))).toFixed(2)
    : Number(local.usdcAmount).toFixed(2);

  const platformLabel = local.platforms.join(", ") || "—";

  return (
    <div
      style={{
        ...card,
        padding: "13px 15px",
        margin: "0 18px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        {local.platforms[0] && <PlatBadge k={local.platforms[0]} sz={24} />}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {local.platforms.length > 0
            ? local.platforms.map((p) => platDisplayName(p)).join(" · ")
            : "Deposit"}
        </span>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            padding: "3px 8px",
            borderRadius: 6,
            color: accepting ? "var(--yes)" : "var(--muted-2)",
            background: accepting ? "var(--yes-soft)" : "var(--bg-soft)",
          }}
        >
          {accepting ? "active" : "paused"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          fontFamily: "var(--f-tech)",
          fontSize: 10.5,
          color: "var(--muted)",
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <span>
          Available{" "}
          <strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>{available} USDC</strong>
        </span>
        <span>
          Via <strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>{platformLabel}</strong>
        </span>
        <span style={{ color: "var(--muted-2)" }}>{timeAgo(local.createdAt)}</span>
      </div>

      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 9,
          color: "var(--muted-2)",
          marginTop: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}
      >
        {local.depositId.slice(0, 18)}...
      </div>
    </div>
  );
}

function IntentCard({ intent }: { intent: TrackedPeerIntent }) {
  const isBuy = intent.side === "buy";
  const isActive = PEER_INTENT_ACTIVE.includes(intent.status);
  const isTerminal = intent.status === "fulfilled" || intent.status === "bridged";
  const isFailed = intent.status === "cancelled" || intent.status === "failed";

  const statusColor =
    isActive || isTerminal ? "var(--yes)" : isFailed ? "var(--no)" : "var(--muted-2)";
  const statusBg =
    isActive || isTerminal ? "var(--yes-soft)" : isFailed ? "var(--no-soft)" : "var(--bg-soft)";

  return (
    <div
      style={{
        ...card,
        padding: "13px 15px",
        margin: "0 18px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            padding: "3px 8px",
            borderRadius: 6,
            color: isBuy ? "var(--yes)" : "var(--no)",
            background: isBuy ? "var(--yes-soft)" : "var(--no-soft)",
          }}
        >
          {intent.side}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>{intent.platform}</span>
        <span
          style={{
            fontFamily: "var(--f-tech)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            padding: "2px 7px",
            borderRadius: 6,
            color: statusColor,
            background: statusBg,
          }}
        >
          {intent.status}
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 9,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
          {Number(intent.usdcAmount).toFixed(2)} USDC
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {intent.fiatAmount} {intent.fiatCurrency}
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 9,
          color: "var(--muted-2)",
          marginTop: 5,
        }}
      >
        {timeAgo(intent.createdAt)} · {intent.intentHash.slice(0, 14)}...
      </div>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        margin: "0 18px 10px",
        border: "1px dashed var(--line-2)",
        borderRadius: 13,
        padding: "28px 18px",
        textAlign: "center" as const,
        fontSize: 13,
        color: "var(--muted-2)",
      }}
    >
      {text}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function MobileActivityPanel({
  liveRates,
  ratesLoading,
}: {
  liveRates: Record<string, number | null>;
  ratesLoading: Record<string, boolean>;
}) {
  const { address } = useAccount();
  const client = usePeerClient();

  const localDeposits = address ? listPeerDeposits(address) : [];
  const localIntents = address ? listPeerIntents(address) : [];

  const liveDepositsQ = useQuery({
    queryKey: ["peer", "account-deposits", address ?? "none"],
    queryFn: async (): Promise<LiveDeposit[]> => {
      if (!client || !address) return [];
      const views = await client.getAccountDeposits(address as `0x${string}`);
      return views.map((v) => ({
        depositId: v.depositId.toString(),
        availableLiquidity: v.availableLiquidity.toString(),
        acceptingIntents: v.deposit.acceptingIntents,
      }));
    },
    enabled: !!client && !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const liveMap = new Map<string, LiveDeposit>(
    (liveDepositsQ.data ?? []).map((d) => [d.depositId, d]),
  );

  if (!address) {
    return <EmptyBox text="Connect your wallet to see activity." />;
  }

  const liveDeposits = liveDepositsQ.data ?? [];
  const liveIds = new Set(liveDeposits.map((d) => d.depositId));
  const localOnlyDeposits = localDeposits.filter((d) => !liveIds.has(d.depositId));

  // Merge: prefer on-chain records, append local-only (pending confirmation)
  const displayDeposits: TrackedPeerDeposit[] = [
    ...liveDeposits.map((live) => {
      const local = localDeposits.find((l) => l.depositId === live.depositId);
      return (
        local ?? {
          depositId: live.depositId,
          owner: address,
          platforms: [],
          usdcAmount: baseUnitsToUsdc(BigInt(live.availableLiquidity)),
          status: (live.acceptingIntents ? "active" : "paused") as
            | "active"
            | "paused"
            | "withdrawn",
          createdAt: Date.now(),
        }
      );
    }),
    ...localOnlyDeposits,
  ];

  const hasDeposits = displayDeposits.length > 0;
  const hasIntents = localIntents.length > 0;

  if (!hasDeposits && !hasIntents && !liveDepositsQ.isLoading) {
    return <EmptyBox text="No P2P activity yet. Create a sell deposit to get started." />;
  }

  return (
    <div>
      {/* Deposits section */}
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase" as const,
          color: "var(--muted-2)",
          margin: "0 18px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Sell deposits</span>
        {liveDepositsQ.isLoading && (
          <span style={{ fontWeight: 400, fontSize: 9 }}>Loading...</span>
        )}
      </div>

      {!hasDeposits ? (
        <EmptyBox text="No deposits yet." />
      ) : (
        displayDeposits.map((d) => (
          <DepositCard
            key={d.depositId}
            local={d}
            live={liveMap.get(d.depositId)}
            liveRates={liveRates}
            ratesLoading={ratesLoading}
          />
        ))
      )}

      {/* Intents section */}
      <div
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: ".1em",
          textTransform: "uppercase" as const,
          color: "var(--muted-2)",
          margin: "20px 18px 10px",
        }}
      >
        Buy intents
      </div>

      {!hasIntents ? (
        <EmptyBox text="No buy intents. In-app intent signaling runs through the P2P extension." />
      ) : (
        localIntents.map((intent) => <IntentCard key={intent.intentHash} intent={intent} />)
      )}
    </div>
  );
}

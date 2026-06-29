"use client";

/**
 * ActivityPanel — wallet's Peer deposits + intents, merged from localStorage
 * and live on-chain reads via Zkp2pClient.
 *
 * Deposits: pause/resume via setAcceptingIntents.
 * Intents: shown with current status.
 */

import React from "react";

import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { usePeerClient } from "@/lib/peer/client";
import { baseUnitsToUsdc } from "@/lib/peer/config";
import {
  type TrackedPeerDeposit,
  type TrackedPeerIntent,
  listPeerDeposits,
  listPeerIntents,
  updatePeerDeposit,
} from "@/lib/peer/intentStore";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

// ─── types ────────────────────────────────────────────────────────────────────

interface LiveDeposit {
  depositId: string;
  availableLiquidity: string;
  acceptingIntents: boolean;
  depositBigintId: bigint;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status, active }: { status: string; active?: boolean }) {
  const isGreen =
    status === "active" || active === true || status === "fulfilled" || status === "bridged";
  const isRed = status === "cancelled" || status === "failed" || status === "withdrawn";

  const color = isGreen ? "var(--yes)" : isRed ? "var(--no)" : "var(--muted-2)";
  const bg = isGreen ? "var(--yes-soft)" : isRed ? "var(--no-soft)" : "var(--bg-tint)";
  const border = isGreen ? "rgba(19,185,129,.2)" : isRed ? "rgba(240,67,106,.2)" : "var(--line)";

  return (
    <span
      style={{
        fontFamily: "var(--f-tech)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {status}
    </span>
  );
}

// ─── DepositRow ───────────────────────────────────────────────────────────────

function DepositRow({
  local,
  live,
  address,
  onToggle,
  toggling,
}: {
  local: TrackedPeerDeposit;
  live: LiveDeposit | undefined;
  address: string;
  onToggle: (depositId: bigint, accept: boolean) => void;
  toggling: boolean;
}) {
  const accepting = live ? live.acceptingIntents : local.status === "active";
  const available = live ? baseUnitsToUsdc(BigInt(live.availableLiquidity)) : local.usdcAmount;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 13,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span
              style={{
                fontFamily: "var(--f-tech)",
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--muted-2)",
              }}
            >
              Deposit
            </span>
            <StatusPill status={accepting ? "active" : "paused"} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="price" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
              {Number(available).toFixed(2)} USDC
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              via {local.platforms.join(", ")}
            </span>
          </div>
          <span style={{ fontFamily: "var(--f-tech)", fontSize: 10, color: "var(--muted-2)" }}>
            {timeAgo(local.createdAt)} · {local.depositId.slice(0, 10)}…
          </span>
        </div>

        <div style={{ flexShrink: 0 }}>
          {live ? (
            <button
              type="button"
              className={cn("btn btn-sm", accepting ? "btn-ghost" : "btn-primary")}
              onClick={() => onToggle(live.depositBigintId, !accepting)}
              disabled={toggling}
              style={{ fontSize: 12, padding: "7px 14px" }}
            >
              {toggling ? "…" : accepting ? "Pause" : "Resume"}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 700 }}>
              Manage from this panel
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── IntentRow ────────────────────────────────────────────────────────────────

function IntentRow({ intent }: { intent: TrackedPeerIntent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 13,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: intent.side === "buy" ? "var(--yes)" : "var(--no)",
              background: intent.side === "buy" ? "var(--yes-soft)" : "var(--no-soft)",
              border: `1px solid ${intent.side === "buy" ? "rgba(19,185,129,.2)" : "rgba(240,67,106,.2)"}`,
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {intent.side}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{intent.platform}</span>
        </div>
        <StatusPill status={intent.status} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 8 }}>
        <span className="price" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
          {Number(intent.usdcAmount).toFixed(2)} USDC
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {intent.fiatAmount} {intent.fiatCurrency}
        </span>
      </div>
      <span
        style={{
          display: "block",
          fontFamily: "var(--f-tech)",
          fontSize: 10,
          color: "var(--muted-2)",
          marginTop: 4,
        }}
      >
        {timeAgo(intent.createdAt)} · {intent.intentHash.slice(0, 10)}…
      </span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ActivityPanel() {
  const { address } = useAccount();
  const client = usePeerClient();

  const [togglingId, setTogglingId] = React.useState<string | null>(null);

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
        depositBigintId: v.depositId,
      }));
    },
    enabled: !!client && !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const liveMap = new Map<string, LiveDeposit>(
    (liveDepositsQ.data ?? []).map((d) => [d.depositId, d]),
  );

  async function handleToggle(depositBigintId: bigint, accept: boolean) {
    if (!client || !address) return;
    const idStr = depositBigintId.toString();
    setTogglingId(idStr);
    try {
      await client.setAcceptingIntents({
        depositId: depositBigintId,
        accepting: accept,
      });
      updatePeerDeposit(address, idStr, { status: accept ? "active" : "paused" });
      toast.success({
        title: accept ? "Deposit resumed" : "Deposit paused",
        description: accept
          ? "Your offer is accepting new buyers."
          : "No new buyers will be matched.",
      });
      await liveDepositsQ.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error({ title: "Toggle failed", description: msg.slice(0, 200) });
    } finally {
      setTogglingId(null);
    }
  }

  const emptyBox = (text: string) => (
    <div
      style={{
        border: "1px dashed var(--line-2)",
        borderRadius: 13,
        padding: "28px 18px",
        textAlign: "center",
        fontSize: 13,
        color: "var(--muted-2)",
      }}
    >
      {text}
    </div>
  );

  if (!address) {
    return emptyBox("Connect your wallet to see activity.");
  }

  const hasDeposits = localDeposits.length > 0 || (liveDepositsQ.data ?? []).length > 0;
  const hasIntents = localIntents.length > 0;

  if (!hasDeposits && !hasIntents && !liveDepositsQ.isLoading) {
    return emptyBox("No P2P activity yet. Create a sell deposit or buy via the extension.");
  }

  const liveDeposits = liveDepositsQ.data ?? [];
  const liveIds = new Set(liveDeposits.map((d) => d.depositId));
  const localOnlyDeposits = localDeposits.filter((d) => !liveIds.has(d.depositId));

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Sell deposits */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
            }}
          >
            Sell deposits
          </span>
          {liveDepositsQ.isLoading && (
            <span style={{ fontSize: 10, color: "var(--muted-2)" }}>Loading…</span>
          )}
        </div>
        {displayDeposits.length === 0 ? (
          emptyBox("No deposits yet.")
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {displayDeposits.map((d) => (
              <DepositRow
                key={d.depositId}
                local={d}
                live={liveMap.get(d.depositId)}
                address={address}
                onToggle={handleToggle}
                toggling={togglingId === d.depositId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Buy intents */}
      <div>
        <span
          style={{
            display: "block",
            fontFamily: "var(--f-tech)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted-2)",
            marginBottom: 10,
          }}
        >
          Buy intents
        </span>
        {localIntents.length === 0 ? (
          emptyBox(
            "No buy intents tracked. In-app intent signaling ships next; for now it runs through the P2P extension.",
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {localIntents.map((intent) => (
              <IntentRow key={intent.intentHash} intent={intent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

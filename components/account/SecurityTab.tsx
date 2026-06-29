"use client";

/**
 * components/account/SecurityTab.tsx
 *
 * Security overview:
 *   - Linked login methods (from Privy user)
 *   - Active session info (Privy)
 *   - Polymarket trading cred status (whether useDeriveCreds has run this session)
 *   - Allowances note (link out to revoke.cash)
 *
 * No on-chain allowance scanning here — honest link-out to revoke.cash.
 */

import { useDeriveCreds } from "@/lib/polymarket/useDeriveCreds";
import { usePrivy } from "@privy-io/react-auth";
import { ExternalLink, Shield } from "lucide-react";
import { useAccount } from "wagmi";

function shorten(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function SectionCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pf-card">
      <div style={{ marginBottom: 12 }}>
        <div className="eyebrow">
          <span className="tick" />
          {title}
        </div>
        {sub && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {sub}
          </p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--f-tech)",
          fontSize: 12,
          fontWeight: 700,
          color: ok === true ? "var(--yes)" : ok === false ? "var(--no)" : "var(--muted)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function SecurityTab() {
  const { user, ready, authenticated } = usePrivy();
  const { address } = useAccount();
  const { creds, ready: credsReady } = useDeriveCreds();

  if (!ready || !authenticated) return null;

  const linked = user?.linkedAccounts ?? [];

  // Login methods summary
  const methods: string[] = [];
  if (user?.email?.address) methods.push(`Email (${user.email.address})`);
  if (user?.google?.email) methods.push(`Google (${user.google.email})`);
  if (user?.apple?.email) methods.push("Apple");
  if (
    linked.some(
      (a) =>
        a.type === "wallet" && (a as { walletClientType?: string }).walletClientType !== "privy",
    )
  )
    methods.push("External wallet");
  if (methods.length === 0) methods.push("Embedded wallet only");

  // Embedded wallet
  const embeddedWallet = linked.find(
    (a) => a.type === "wallet" && (a as { walletClientType?: string }).walletClientType === "privy",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Login methods */}
      <SectionCard title="Login methods" sub="Linked methods that can authenticate this account.">
        {methods.map((m) => (
          <StatusRow key={m} label={m} value="Linked" ok={true} />
        ))}
        {methods.length < 2 && (
          <div
            style={{
              background: "var(--bg-soft)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            Link a second login method (email, Google, or an external wallet) from the Wallet tab so
            you can recover this account if you lose access to your primary login.
          </div>
        )}
      </SectionCard>

      {/* Wallet + session */}
      <SectionCard title="Wallet and session">
        {address && <StatusRow label="Connected address" value={shorten(address)} />}
        {embeddedWallet && (
          <StatusRow
            label="Embedded wallet"
            value={
              (embeddedWallet as { address?: string }).address
                ? shorten((embeddedWallet as { address: string }).address)
                : "Active"
            }
            ok={true}
          />
        )}
        <StatusRow
          label="Session status"
          value={authenticated ? "Authenticated" : "Not signed in"}
          ok={authenticated}
        />
        <StatusRow label="Provider" value="Privy embedded wallet" />
      </SectionCard>

      {/* Polymarket creds */}
      <SectionCard
        title="Trading credentials"
        sub="Polymarket L2 CLOB credentials. Derived from a wallet signature; stored in memory only (reset on page reload)."
      >
        <StatusRow
          label="Polymarket trading creds"
          value={!credsReady ? "Wallet not ready" : creds ? "Active this session" : "Not derived"}
          ok={!!creds}
        />
        {creds && <StatusRow label="CLOB address" value={shorten(creds.address)} ok={true} />}
        {!creds && credsReady && (
          <div style={{ fontSize: 12, color: "var(--muted-2)", lineHeight: 1.5 }}>
            Go to the Activity tab and click "Load bets" to derive your PM credentials for this
            session. They live in memory only; no server storage.
          </div>
        )}
      </SectionCard>

      {/* Allowances */}
      <SectionCard
        title="Token allowances"
        sub="ERC-20 allowances granted to router and relayer contracts when you approve swaps or bridges."
      >
        <div
          style={{
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 9,
            padding: "14px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <Shield
            className="size-5 mt-0.5 flex-shrink-0"
            style={{ color: "var(--brand)", marginTop: 2 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
              Review approvals on revoke.cash
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              This app does not store an on-chain allowance scanner. Use revoke.cash to see every
              approval your address has granted and revoke any you no longer need.
            </p>
            {address && (
              <a
                href={`https://revoke.cash/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 10,
                  fontFamily: "var(--f-tech)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--brand)",
                  textDecoration: "none",
                }}
              >
                View allowances for {shorten(address)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: "var(--muted-2)", lineHeight: 1.5 }}>
          FX Terminal only requests allowances when you initiate a swap or bridge. Approvals are scoped
          to the specific router (LiFi, KyberSwap, CoW, or the FX provider).
        </p>
      </SectionCard>
    </div>
  );
}

import type React from "react";

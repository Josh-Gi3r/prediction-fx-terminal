"use client";

import "../portfolio/portfolio.css";
import "./account.css";
import { ActivityTab } from "@/components/account/ActivityTab";
import { SecurityTab } from "@/components/account/SecurityTab";
import { SettingsTab } from "@/components/account/SettingsTab";
import { WalletTab } from "@/components/account/WalletTab";
import { ConnectButton } from "@/components/shared/ConnectButton";
import { Nav } from "@/components/shared/Nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount } from "wagmi";

// ─── Valid tabs ────────────────────────────────────────────────────────────────

const VALID_TABS = ["wallet", "activity", "settings", "security"] as const;
type AccountTab = (typeof VALID_TABS)[number];

function isValidTab(s: string | null): s is AccountTab {
  return VALID_TABS.includes(s as AccountTab);
}

// ─── Disconnected state ───────────────────────────────────────────────────────

function DisconnectedState() {
  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <div
        className="wrap"
        style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 500, margin: "0 auto" }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--sh-2)",
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "var(--bg-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
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
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>
            Connect to view your account
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            Your wallet, activity history, settings, and security overview are available once
            connected.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
          <p
            style={{
              marginTop: 16,
              fontSize: 11,
              fontFamily: "var(--f-tech)",
              color: "var(--muted-2)",
            }}
          >
            Non-custodial. Your keys stay with you.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Inner page (reads searchParams) ─────────────────────────────────────────

function AccountPageInner() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const initialTab: AccountTab = isValidTab(rawTab) ? rawTab : "wallet";
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);

  // Keep URL in sync when tab changes programmatically
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — router/pathname stable refs
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeTab]);

  // Sync tab if searchParams changes externally (e.g. chip deep-link)
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTab intentionally excluded to avoid loop
  useEffect(() => {
    const t = searchParams.get("tab");
    if (isValidTab(t) && t !== activeTab) {
      setActiveTab(t);
    }
  }, [searchParams]);

  if (!isConnected) return <DisconnectedState />;

  return (
    <div className="ds4" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* Page header */}
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 6 }}>
        <div className="acct-header">
          <div>
            <span className="eyebrow">
              <span className="tick" />
              Account
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Your account"}
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="wrap" style={{ paddingTop: 16, paddingBottom: 60 }}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountTab)}>
          <TabsList className="acct-tab-list">
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <div style={{ marginTop: 20 }}>
            <TabsContent value="wallet">
              <WalletTab address={address as `0x${string}`} />
            </TabsContent>

            <TabsContent value="activity">
              <ActivityTab address={address as `0x${string}`} />
            </TabsContent>

            <TabsContent value="settings">
              <SettingsTab />
            </TabsContent>

            <TabsContent value="security">
              <SecurityTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountPageInner />
    </Suspense>
  );
}

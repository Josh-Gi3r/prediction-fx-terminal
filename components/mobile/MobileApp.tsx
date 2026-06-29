"use client";

import "@/app/mobile.css";
import { useTelegramLogin } from "@/app/providers";
import { WcPromoPopup } from "@/components/shared/WcPromoPopup";
import { PRIVY_ENABLED } from "@/lib/privy/config";
import { useTelegram } from "@/lib/telegram/useTelegram";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { BetSlip } from "./BetSlip";
import type { SlipMarket } from "./BetSlip";
import { Icon } from "./Icon";
import { MobileAccountSheet } from "./MobileAccountSheet";
import type { WcMatch } from "./data";

import { EarnScreen } from "./screens/EarnScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MarketDetailScreen } from "./screens/MarketDetailScreen";
import type { SpecialMarket } from "./screens/MarketDetailScreen";
import { MarketsScreen } from "./screens/MarketsScreen";
import { MatchDetailScreen } from "./screens/MatchDetailScreen";
import { P2PScreen } from "./screens/P2PScreen";
import { PortfolioScreen } from "./screens/PortfolioScreen";
import { SwapScreen } from "./screens/SwapScreen";
import { TradeScreen } from "./screens/TradeScreen";
import { WorldCupScreen } from "./screens/WorldCupScreen";

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = "home" | "cup" | "swap" | "earn" | "markets" | "p2p" | "trade" | "portfolio";

// ── Bottom tab bar: Home · WC · [+] · Swap · Earn ───────────────────────────────
function TabBar({
  tab,
  go,
  onPlus,
  actionOpen,
}: {
  tab: Tab | null;
  go: (t: Tab) => void;
  onPlus: () => void;
  actionOpen: boolean;
}) {
  const items: { k: Tab; label: string; icon: string }[] = [
    { k: "home", label: "Home", icon: "home" },
    { k: "cup", label: "WC", icon: "cup" },
    { k: "swap", label: "Swap", icon: "swap" },
    { k: "earn", label: "Earn", icon: "bolt" },
  ];
  const T = (it: { k: Tab; label: string; icon: string }) => (
    <button
      key={it.k}
      type="button"
      className={`tab${tab === it.k ? " on" : ""}`}
      onClick={() => go(it.k)}
    >
      <Icon name={it.icon} size={23} stroke={tab === it.k ? 2.2 : 1.9} />
      <span className="tl">{it.label}</span>
    </button>
  );
  return (
    <div className="tabbar">
      {T(items[0] as (typeof items)[number])}
      {T(items[1] as (typeof items)[number])}
      <button type="button" className="tab center" onClick={onPlus} aria-label="More">
        <span className={`tab-fab${actionOpen ? " open" : ""}`}>
          <Icon name="plus" size={26} color="#fff" stroke={2.4} />
        </span>
      </button>
      {T(items[2] as (typeof items)[number])}
      {T(items[3] as (typeof items)[number])}
    </div>
  );
}

// ── [+] quick-action menu ───────────────────────────────────────────────────────
function ActionMenu({
  open,
  onClose,
  go,
}: {
  open: boolean;
  onClose: () => void;
  go: (t: Tab) => void;
}) {
  const items: { ic: string; t: string; d: string; bg: string; run: () => void }[] = [
    {
      ic: "trade",
      t: "Predict FX",
      d: "Forwards & differential perps",
      bg: "var(--grad-brand)",
      run: () => go("trade"),
    },
    {
      ic: "cash",
      t: "P2P Cash",
      d: "On / off-ramp · Wise, Revolut, Venmo",
      bg: "var(--grad-mint)",
      run: () => go("p2p"),
    },
    {
      ic: "wallet",
      t: "Portfolio",
      d: "Positions, P&L & activity",
      bg: "var(--grad-mint)",
      run: () => go("portfolio"),
    },
  ];
  return (
    <>
      <div className={`qa-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`qa-menu${open ? " open" : ""}`}>
        <div className="qa-cap">Quick actions</div>
        {items.map((it) => (
          <button
            type="button"
            className="qa-item"
            key={it.t}
            onClick={() => {
              onClose();
              it.run();
            }}
          >
            <span className="qa-ic" style={{ background: it.bg, color: "#fff" }}>
              <Icon name={it.ic} size={21} color="#fff" />
            </span>
            <div>
              <h4>{it.t}</h4>
              <p>{it.d}</p>
            </div>
            <span className="grow" />
            <Icon name="chevron" size={15} color="var(--muted-2)" />
          </button>
        ))}
      </div>
    </>
  );
}

// ── Main shell (requires Privy context mounted above) ──────────────────────────
function MobileAppInner() {
  const [tab, setTab] = useState<Tab>("home");
  const [detail, setDetail] = useState<WcMatch | null>(null);
  const [marketDetail, setMarketDetail] = useState<SpecialMarket | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{ from: string; to: string } | null>(null);
  const [slip, setSlip] = useState<{ market: SlipMarket | null; open: boolean }>({
    market: null,
    open: false,
  });
  const [toast, setToast] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  // ── Privy auth state ───────────────────────────────────────────────────────
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address ?? null;

  // ── Telegram Mini App integration ─────────────────────────────────────────
  const tg = useTelegram();
  const { loginForTelegram } = useTelegramLogin();

  const go = useCallback(
    (t: string) => {
      setActionOpen(false);
      setAccountSheetOpen(false);
      setDetail(null);
      setMarketDetail(null);
      setPendingSwap(null);
      setTab(t as Tab);
      // Light haptic on tab switch (only in Telegram, no-op otherwise)
      tg.hapticSelection();
    },
    [tg],
  );
  const openMatch = useCallback((m: WcMatch) => {
    setActionOpen(false);
    setMarketDetail(null);
    setDetail(m);
  }, []);
  const openMarket = useCallback((p: SpecialMarket) => {
    setActionOpen(false);
    setDetail(null);
    setMarketDetail(p);
  }, []);
  const openView = useCallback((v: string) => go(v), [go]);
  const openSwap = useCallback(
    (from: string, to: string) => {
      setActionOpen(false);
      setDetail(null);
      setMarketDetail(null);
      setPendingSwap({ from, to });
      setTab("swap");
      tg.hapticSelection();
    },
    [tg],
  );
  const back = useCallback(() => {
    setDetail(null);
    setMarketDetail(null);
  }, []);
  const openSlip = useCallback((market: SlipMarket) => setSlip({ market, open: true }), []);
  const closeSlip = useCallback(() => setSlip((s) => ({ ...s, open: false })), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Telegram BackButton: show when on a detail screen, hide on root ────────
  const isDetailOpen = !!(detail || marketDetail);
  useEffect(() => {
    if (!tg.isTelegram) return;
    if (isDetailOpen) {
      tg.showBackButton(back);
    } else {
      tg.hideBackButton();
    }
  }, [tg, isDetailOpen, back]);

  // ── FAB haptic ────────────────────────────────────────────────────────────
  const handlePlus = useCallback(() => {
    tg.hapticImpact("light");
    setActionOpen((o) => !o);
  }, [tg]);

  // ── Account button in HomeScreen appbar ───────────────────────────────────
  // In Telegram: use Telegram-native login (falls back to email-only if not configured).
  // Outside Telegram: use the full Privy modal as before.
  const handleAccountPress = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      try {
        if (tg.isTelegram && loginForTelegram) {
          await loginForTelegram();
        } else {
          await login();
        }
      } catch {
        // user dismissed
      }
      return;
    }
    setAccountSheetOpen(true);
  }, [ready, authenticated, login, tg.isTelegram, loginForTelegram]);

  const isDark = !!detail || !!marketDetail || tab === "cup";

  let screen: React.ReactNode;
  if (marketDetail) {
    screen = (
      <MarketDetailScreen
        p={marketDetail}
        onBack={back}
        openSlip={openSlip}
        openMarket={openMarket}
      />
    );
  } else if (detail) {
    screen = <MatchDetailScreen m={detail} onBack={back} openSlip={openSlip} />;
  } else if (tab === "home") {
    screen = (
      <HomeScreen
        openMatch={openMatch}
        openSlip={openSlip}
        go={go}
        openView={openView}
        onAccountPress={handleAccountPress}
        authenticated={authenticated}
        address={address}
        privyReady={ready}
      />
    );
  } else if (tab === "cup") {
    screen = <WorldCupScreen openMatch={openMatch} openSlip={openSlip} openMarket={openMarket} />;
  } else if (tab === "trade") {
    screen = <TradeScreen onToast={showToast} openSlip={openSlip} />;
  } else if (tab === "swap") {
    screen = (
      <SwapScreen
        key={pendingSwap ? pendingSwap.from + pendingSwap.to : "swap"}
        onBack={() => go("home")}
        onToast={showToast}
        onOpenMarkets={() => go("markets")}
        initialFrom={pendingSwap?.from}
        initialTo={pendingSwap?.to}
      />
    );
  } else if (tab === "earn") {
    screen = <EarnScreen onBack={() => go("home")} onToast={showToast} />;
  } else if (tab === "markets") {
    screen = <MarketsScreen openSwap={openSwap} />;
  } else if (tab === "p2p") {
    screen = <P2PScreen onToast={showToast} />;
  } else {
    screen = <PortfolioScreen go={go} openView={openView} />;
  }

  return (
    <div className="app" data-theme={isDark ? "dark" : "light"}>
      {screen}

      {/* WC promo — home tab only, same once-per-visitor key as desktop */}
      {tab === "home" && !detail && !marketDetail && (
        <WcPromoPopup mobile={{ onGoWc: () => go("cup") }} />
      )}

      <TabBar
        tab={detail || marketDetail ? null : tab}
        go={go}
        onPlus={handlePlus}
        actionOpen={actionOpen}
      />
      <ActionMenu open={actionOpen} onClose={() => setActionOpen(false)} go={go} />

      {/* Mobile account sheet — only mounts when Privy is available */}
      <MobileAccountSheet
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        onGoPortfolio={() => go("portfolio")}
      />

      <BetSlip
        market={slip.market}
        open={slip.open}
        onClose={closeSlip}
        onPlaced={() => showToast("Position placed · settled onchain")}
      />

      <div className={`toast${toast ? " show" : ""}`}>
        <Icon name="check" size={16} color="#7dffce" stroke={3} />
        {toast}
      </div>
    </div>
  );
}

/**
 * MobileApp
 *
 * Public entry point. Routes to a minimal connect-only shell when Privy is
 * not configured so static prerender works without credentials.
 */
export function MobileApp() {
  if (!PRIVY_ENABLED) {
    // Privy not configured: render inner without hooks that need Privy context.
    // Swap out for a version that won't blow up on missing PrivyProvider.
    return <MobileAppNoPrivy />;
  }
  return <MobileAppInner />;
}

/** Fallback rendered when PRIVY_APP_ID is not set. Identical shell but the
 *  account button is permanently in "Connect" mode (non-functional). */
function MobileAppNoPrivy() {
  const [tab, setTab] = useState<
    "home" | "cup" | "swap" | "earn" | "markets" | "p2p" | "trade" | "portfolio"
  >("home");
  const [detail, setDetail] = useState<WcMatch | null>(null);
  const [marketDetail, setMarketDetail] = useState<SpecialMarket | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{ from: string; to: string } | null>(null);
  const [slip, setSlip] = useState<{ market: SlipMarket | null; open: boolean }>({
    market: null,
    open: false,
  });
  const [toast, setToast] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const tg = useTelegram();

  const go = useCallback(
    (t: string) => {
      setActionOpen(false);
      setDetail(null);
      setMarketDetail(null);
      setPendingSwap(null);
      setTab(t as typeof tab);
      tg.hapticSelection();
    },
    [tg],
  );

  const openMatch = useCallback((m: WcMatch) => {
    setActionOpen(false);
    setMarketDetail(null);
    setDetail(m);
  }, []);
  const openMarket = useCallback((p: SpecialMarket) => {
    setActionOpen(false);
    setDetail(null);
    setMarketDetail(p);
  }, []);
  const openView = useCallback((v: string) => go(v), [go]);
  const openSwap = useCallback(
    (from: string, to: string) => {
      setActionOpen(false);
      setDetail(null);
      setMarketDetail(null);
      setPendingSwap({ from, to });
      setTab("swap");
      tg.hapticSelection();
    },
    [tg],
  );
  const back = useCallback(() => {
    setDetail(null);
    setMarketDetail(null);
  }, []);
  const openSlip = useCallback((market: SlipMarket) => setSlip({ market, open: true }), []);
  const closeSlip = useCallback(() => setSlip((s) => ({ ...s, open: false })), []);
  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const isDetailOpen = !!(detail || marketDetail);
  useEffect(() => {
    if (!tg.isTelegram) return;
    if (isDetailOpen) tg.showBackButton(back);
    else tg.hideBackButton();
  }, [tg, isDetailOpen, back]);

  const handlePlus = useCallback(() => {
    tg.hapticImpact("light");
    setActionOpen((o) => !o);
  }, [tg]);
  const isDark = !!detail || !!marketDetail || tab === "cup";

  let screen: React.ReactNode;
  if (marketDetail) {
    screen = (
      <MarketDetailScreen
        p={marketDetail}
        onBack={back}
        openSlip={openSlip}
        openMarket={openMarket}
      />
    );
  } else if (detail) {
    screen = <MatchDetailScreen m={detail} onBack={back} openSlip={openSlip} />;
  } else if (tab === "home") {
    screen = (
      <HomeScreen
        openMatch={openMatch}
        openSlip={openSlip}
        go={go}
        openView={openView}
        onAccountPress={() => {}}
        authenticated={false}
        address={null}
        privyReady={false}
      />
    );
  } else if (tab === "cup") {
    screen = <WorldCupScreen openMatch={openMatch} openSlip={openSlip} openMarket={openMarket} />;
  } else if (tab === "trade") {
    screen = <TradeScreen onToast={showToast} openSlip={openSlip} />;
  } else if (tab === "swap") {
    screen = (
      <SwapScreen
        key={pendingSwap ? pendingSwap.from + pendingSwap.to : "swap"}
        onBack={() => go("home")}
        onToast={showToast}
        onOpenMarkets={() => go("markets")}
        initialFrom={pendingSwap?.from}
        initialTo={pendingSwap?.to}
      />
    );
  } else if (tab === "earn") {
    screen = <EarnScreen onBack={() => go("home")} onToast={showToast} />;
  } else if (tab === "markets") {
    screen = <MarketsScreen openSwap={openSwap} />;
  } else if (tab === "p2p") {
    screen = <P2PScreen onToast={showToast} />;
  } else {
    screen = <PortfolioScreen go={go} openView={openView} />;
  }

  return (
    <div className="app" data-theme={isDark ? "dark" : "light"}>
      {screen}
      {tab === "home" && !detail && !marketDetail && (
        <WcPromoPopup mobile={{ onGoWc: () => go("cup") }} />
      )}
      <TabBar
        tab={detail || marketDetail ? null : tab}
        go={go}
        onPlus={handlePlus}
        actionOpen={actionOpen}
      />
      <ActionMenu open={actionOpen} onClose={() => setActionOpen(false)} go={go} />
      <BetSlip
        market={slip.market}
        open={slip.open}
        onClose={closeSlip}
        onPlaced={() => showToast("Position placed · settled onchain")}
      />
      <div className={`toast${toast ? " show" : ""}`}>
        <Icon name="check" size={16} color="#7dffce" stroke={3} />
        {toast}
      </div>
    </div>
  );
}

"use client";

import { CORRIDORS } from "@/lib/corridors/registry";
import { useMultiChainBalances } from "@/lib/portfolio/chains";
import { fxClient } from "@/lib/fx-provider";
import { fmtUsd } from "@/lib/fx-provider/core/format";
import { normalizePmTeamName } from "@/lib/wc2026/teamAlias";
import { useWcMarkets } from "@/lib/wc2026/usePm";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SlipMarket } from "../BetSlip";
import { Icon } from "../Icon";
import { COR, FEATURED, WC_MATCHES, type WcMatch } from "../data";
import { Disclaimer, FeaturedCard, MatchCardCompact, MobileLogo } from "../primitives";

interface HomeScreenProps {
  openMatch: (m: WcMatch) => void;
  openSlip: (m: SlipMarket) => void;
  go: (tab: string) => void;
  openView: (view: string) => void;
  /** Called when the account button / avatar is tapped. */
  onAccountPress: () => void;
  /** Whether the user is currently authenticated via Privy. */
  authenticated: boolean;
  /** Connected wallet address (null when not connected). */
  address: string | null;
  /** True once Privy has finished initialising. */
  privyReady: boolean;
}

// Month abbrev -> zero-padded number (mirrors MatchDetailScreen logic)
const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function matchIsoDate(date: string): string | null {
  const mt = date.match(/^([A-Za-z]{3})\s+(\d{1,2})/);
  if (!mt) return null;
  const mm = MONTHS[(mt[1] ?? "").toLowerCase()];
  if (!mm) return null;
  return `2026-${mm}-${(mt[2] ?? "").padStart(2, "0")}`;
}

/** Derive a short display label from address / auth state. */
function accountLabel(authenticated: boolean, address: string | null): string {
  if (!authenticated) return "Connect";
  if (address) return `${address.slice(0, 4)}..${address.slice(-3)}`;
  return "Account";
}

// The first 4 COR entries map 1:1 to the first 4 CORRIDORS (EUR, JPY, GBP, SGD).
const HOME_CORRIDORS = COR.slice(0, 4);
const HOME_CORRIDOR_DEFS = CORRIDORS.slice(0, 4);

export function HomeScreen({
  openMatch,
  openSlip: _openSlip,
  go,
  openView,
  onAccountPress,
  authenticated,
  address,
  privyReady,
}: HomeScreenProps) {
  const trending = WC_MATCHES.slice(0, 4);

  const tiles = [
    { icon: "forward", k: "Forwards", d: "Lock today's rate", t: "trade" },
    { icon: "trade", k: "Perps", d: "Up to 100x leverage", t: "trade" },
    { icon: "swap", k: "Swap FX", d: "Best price, every swap", view: "swap", mint: true },
    { icon: "cup", k: "Predictions", d: "World Cup YES / NO", t: "cup", mint: true },
  ];

  // Live WC match markets for the featured match (Brazil vs France)
  const { data: wcData } = useWcMarkets({ category: "match" });
  const liveFeatured = useMemo(() => {
    const ms = wcData?.markets ?? [];
    const iso = matchIsoDate(FEATURED.date);
    const home = normalizePmTeamName(FEATURED.h);
    const away = normalizePmTeamName(FEATURED.a);
    const find = (team: string | null) =>
      ms.find((k) => k.teamName === team && (iso ? k.question.includes(iso) : false)) ?? null;
    const homeWin = find(home);
    const awayWin = find(away);
    const slug = homeWin?.eventSlug ?? awayWin?.eventSlug ?? null;
    const draw = slug
      ? (ms.find((k) => k.eventSlug === slug && /draw/i.test(k.question)) ?? null)
      : null;
    return { homeWin, awayWin, draw };
  }, [wcData]);

  // Build a live-enriched version of FEATURED for FeaturedCard
  const featuredMatch: WcMatch = useMemo(() => {
    const { homeWin, awayWin, draw } = liveFeatured;
    if (!homeWin && !awayWin) return FEATURED;

    const rawH = homeWin?.yesPrice != null ? Math.round(homeWin.yesPrice * 100) : null;
    const rawA = awayWin?.yesPrice != null ? Math.round(awayWin.yesPrice * 100) : null;
    const rawD = draw?.yesPrice != null ? Math.round(draw.yesPrice * 100) : null;

    if (rawH == null && rawA == null) return FEATURED;

    const sumRaw = (rawH ?? FEATURED.ph) + (rawA ?? FEATURED.pa) + (rawD ?? FEATURED.pd);
    const scale = sumRaw > 0 ? 100 / sumRaw : 1;
    const ph = Math.round((rawH ?? FEATURED.ph) * scale);
    const pa = Math.round((rawA ?? FEATURED.pa) * scale);
    const pd = 100 - ph - pa;

    return { ...FEATURED, ph, pd, pa };
  }, [liveFeatured]);

  // Real portfolio balance from the same hook the desktop AccountChip uses.
  // Only fires real RPC calls when an address is present.
  const { totalUsd, anyLoading } = useMultiChainBalances(
    authenticated && address ? (address as `0x${string}`) : undefined,
  );

  // Balance display — fmtUsd guarantees always-2dp, consistent with mobile PortfolioScreen
  const showRealBalance = authenticated && address != null;
  const balanceValue = showRealBalance ? (anyLoading ? "..." : fmtUsd(totalUsd)) : "$0.00";
  const balanceLabel = showRealBalance ? "Portfolio value" : "Portfolio value";
  const balanceSub = showRealBalance
    ? anyLoading
      ? "Loading balances..."
      : "Live balance across all chains"
    : "Connect a wallet for live balances";

  // Live FX rates for the corridor strip — same source as the desktop LiveTickerTape.
  // Falls back to the static COR snapshot if the FX provider is unavailable.
  const fxQueries = useQueries({
    queries: HOME_CORRIDOR_DEFS.map((c) => ({
      queryKey: ["fx-provider", "fx-rate", c.isoBase, c.isoQuote] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => fxClient.fxRate(c.isoBase, c.isoQuote, signal),
      staleTime: 10_000,
      refetchInterval: 15_000,
      retry: 1,
    })),
  });

  const corridors = HOME_CORRIDORS.map((c, i) => {
    const q = fxQueries[i];
    if (q?.data?.rate) {
      const rateNum = Number.parseFloat(q.data.rate);
      const chgNum = q.data.change_pct ? Number.parseFloat(q.data.change_pct) : c.chg;
      const priceStr = rateNum >= 100 ? rateNum.toFixed(2) : rateNum.toFixed(4);
      return { ...c, price: priceStr, chg: chgNum };
    }
    return c;
  });

  return (
    <div className="screen">
      <div className="appbar">
        <MobileLogo size={20} />
        <span className="grow" />
        {/* Account button: Connect pill when logged out, identity chip when connected */}
        <button
          type="button"
          className="iconbtn"
          aria-label={authenticated ? "Account" : "Connect wallet"}
          onClick={onAccountPress}
          disabled={!privyReady}
          style={
            authenticated
              ? { background: "var(--brand)", color: "#fff", minWidth: 40 }
              : {
                  background: "var(--grad-brand)",
                  color: "#fff",
                  minWidth: 72,
                  width: "auto",
                  paddingLeft: 14,
                  paddingRight: 14,
                  fontFamily: "var(--f-tech)",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: ".02em",
                }
          }
        >
          {authenticated ? (
            <Icon name="wallet" size={18} color="#fff" />
          ) : (
            <span style={{ whiteSpace: "nowrap" }}>{privyReady ? "Connect" : "..."}</span>
          )}
        </button>
      </div>

      <div className="balance">
        <div className="bl">{balanceLabel}</div>
        <div className="bv">
          {balanceValue === "..." ? (
            <span style={{ opacity: 0.5, fontSize: "0.7em" }}>...</span>
          ) : (
            <>
              {balanceValue.includes(".") ? (
                <>
                  {balanceValue.split(".")[0]}
                  <small>.{balanceValue.split(".")[1]}</small>
                </>
              ) : (
                balanceValue
              )}
            </>
          )}
        </div>
        <div className="bd">
          <Icon name="arrow" size={13} color="#7dffce" /> {balanceSub}
        </div>
        <div className="bactions">
          <div className="ba" onClick={() => go("portfolio")}>
            <Icon name="plus" size={18} color="#fff" />
            Deposit
          </div>
          <div className="ba" onClick={() => openView("swap")}>
            <Icon name="swap" size={18} color="#fff" />
            Swap
          </div>
          <div className="ba" onClick={() => go("trade")}>
            <Icon name="trade" size={18} color="#fff" />
            Trade
          </div>
          <div className="ba" onClick={() => openView("earn")}>
            <Icon name="bolt" size={18} color="#fff" />
            Earn
          </div>
        </div>
      </div>

      <div className="sec-head onlight">
        <h2>Live now</h2>
        <span className="more" onClick={() => go("cup")}>
          World Cup <Icon name="chevron" size={13} />
        </span>
      </div>
      <FeaturedCard m={featuredMatch} onClick={() => openMatch(featuredMatch)} />

      <div className="sec-head onlight">
        <h2>Products</h2>
      </div>
      <div className="tiles">
        {tiles.map((t) => (
          <div
            className="tile"
            key={t.k}
            onClick={() => (t.view ? openView(t.view) : go(t.t ?? ""))}
          >
            <div className={`ti${t.mint ? " mint" : ""}`}>
              <Icon name={t.icon} size={20} />
            </div>
            <h3>{t.k}</h3>
            <p>{t.d}</p>
          </div>
        ))}
        <div
          className="tile"
          style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 13 }}
          onClick={() => go("p2p")}
        >
          <div className="ti mint" style={{ marginBottom: 0 }}>
            <Icon name="cash" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 7 }}>
              P2P Cash{" "}
              <span
                style={{
                  fontFamily: "var(--f-tech)",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: ".06em",
                  color: "#fff",
                  background: "var(--grad-mint)",
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
              >
                NEW
              </span>
            </h3>
            <p>On / off-ramp via Wise, Revolut, Venmo, at your own rate.</p>
          </div>
          <Icon name="chevron" size={15} color="var(--muted-2)" />
        </div>
      </div>

      <div className="sec-head onlight">
        <h2>World Cup · trending</h2>
        <span className="more" onClick={() => go("cup")}>
          All <Icon name="chevron" size={13} />
        </span>
      </div>
      <div className="hscroll">
        {trending.map((m) => (
          <MatchCardCompact key={m.n} m={m} onClick={() => openMatch(m)} />
        ))}
      </div>

      <div className="sec-head onlight">
        <h2>FX corridors</h2>
        <span className="more" onClick={() => go("trade")}>
          Trade <Icon name="chevron" size={13} />
        </span>
      </div>
      <div className="listwrap">
        {corridors.map((c) => (
          <div className="lrow" key={c.ccy} onClick={() => go("trade")}>
            <span className="flagc" style={{ minWidth: 50 }}>
              {c.ccy}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lpair">{c.pair}</div>
              <div className="lsub">{c.name}</div>
            </div>
            <div>
              <div className="lval">{c.price}</div>
              <div className={`lchg ${c.chg >= 0 ? "up" : "down"}`}>
                {c.chg >= 0 ? "+" : ""}
                {c.chg.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <Disclaimer />
    </div>
  );
}

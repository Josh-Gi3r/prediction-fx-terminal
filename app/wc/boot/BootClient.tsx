"use client";

import { toast } from "@/components/ui/toast";
import { BetSheet } from "@/components/wc/BetSheet";
import type { PlayerOdds } from "@/lib/wc2026";
import { resolvePlayerVisual } from "@/lib/wc2026/playerVisual";
import { type WcLiveMarket, fmtVolume, useWcMarkets } from "@/lib/wc2026/usePm";
import { useMemo, useState } from "react";

interface Props {
  /** Static enrichment set — club, country, bookie odds. NOT the row source. */
  players: readonly PlayerOdds[];
}

/**
 * ISO-2 map for flagcdn — nation name → iso2 code.
 * Used to show a real flag image on each Golden Boot player row.
 */
const NATION_ISO2: Record<string, string> = {
  France: "fr",
  Norway: "no",
  England: "gb-eng",
  Brazil: "br",
  Argentina: "ar",
  Spain: "es",
  Germany: "de",
  Netherlands: "nl",
  Portugal: "pt",
  "South Korea": "kr",
  Denmark: "dk",
  Poland: "pl",
  Belgium: "be",
  Uruguay: "uy",
  Colombia: "co",
  Mexico: "mx",
  USA: "us",
  "United States": "us",
  Morocco: "ma",
  Senegal: "sn",
  Egypt: "eg",
  Japan: "jp",
  Switzerland: "ch",
  Austria: "at",
  Croatia: "hr",
  Ecuador: "ec",
  Ghana: "gh",
  "Ivory Coast": "ci",
  Tunisia: "tn",
  Algeria: "dz",
  Sweden: "se",
  Turkey: "tr",
  "South Africa": "za",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  Scotland: "gb-sct",
  Australia: "au",
  Canada: "ca",
  Paraguay: "py",
  Czechia: "cz",
  Jordan: "jo",
  Iraq: "iq",
  Haiti: "ht",
  "New Zealand": "nz",
  Uzbekistan: "uz",
  "Cape Verde": "cv",
  "DR Congo": "cd",
};

function flagCdnUrl(nation: string | null): string | null {
  if (!nation) return null;
  const iso = NATION_ISO2[nation];
  return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
}

/**
 * Parse the player name from a golden_boot question.
 * "Will Kylian Mbappe be the top goalscorer at the 2026 World Cup?" → "Kylian Mbappe"
 * "Will Harry Kane win the Golden Boot?" → "Harry Kane"
 */
function parsePlayerName(question: string): string {
  const m = question.match(/^Will (.+?) (?:be the top goalscorer|win the Golden Boot)/i);
  return m?.[1] ?? question;
}

/** Build a lookup from last name (lower) + full name (lower) → static PlayerOdds. */
function buildStaticLookup(players: readonly PlayerOdds[]): Map<string, PlayerOdds> {
  const map = new Map<string, PlayerOdds>();
  for (const p of players) {
    map.set(p.player.toLowerCase(), p);
    const last = p.player.split(" ").pop()?.toLowerCase();
    if (last) map.set(last, p);
  }
  return map;
}

interface SheetState {
  market: WcLiveMarket;
  side: "yes" | "no";
}

export function BootClient({ players }: Props) {
  const { data, isLoading } = useWcMarkets({ category: "golden_boot" });
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const staticLookup = useMemo(() => buildStaticLookup(players), [players]);

  /**
   * Rows = every PM golden_boot market that passed the gate.
   * Each row is enriched with static data (club, bookie odds) where available.
   * Players NOT in the live PM registry get no tradeable row.
   */
  const rows = useMemo((): Array<{
    market: WcLiveMarket;
    parsedName: string;
    static: PlayerOdds | null;
  }> => {
    const markets = data?.markets ?? [];
    return markets
      .filter((m) => m.yesPrice != null)
      .sort((a, b) => (b.yesPrice ?? 0) - (a.yesPrice ?? 0))
      .map((m) => {
        const parsedName = parsePlayerName(m.question);
        const s =
          staticLookup.get(parsedName.toLowerCase()) ??
          staticLookup.get(parsedName.split(" ").pop()?.toLowerCase() ?? "") ??
          null;
        return { market: m, parsedName, static: s };
      });
  }, [data, staticLookup]);

  const maxPct = Math.max(...rows.map((r) => (r.market.yesPrice ?? 0) * 100), 1);

  function handleYesNo(m: WcLiveMarket, side: "yes" | "no") {
    if (!m.key) {
      const pct = m.yesPrice != null ? Math.round(m.yesPrice * 100) : 50;
      const cents = side === "yes" ? pct : 100 - pct;
      toast.info({
        title: "World Cup markets launching soon",
        description: `${side.toUpperCase()} on "${m.question.slice(0, 60)}" @ ${cents}¢. Trading opens once settlement is live.`,
      });
      return;
    }
    setSheet({ market: m, side });
  }

  if (isLoading) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          boxShadow: "var(--sh-2)",
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            key={i}
            style={{
              height: 56,
              borderBottom: "1px solid var(--line)",
              background: i % 2 === 0 ? "#fff" : "var(--bg-soft)",
            }}
          />
        ))}
      </div>
    );
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px 24px",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: 14,
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
        }}
      >
        No live Golden Boot markets found. Check back once books open.
      </div>
    );
  }

  return (
    <>
      <div className="boot">
        <div className="boot-h">
          <span>#</span>
          <span>Player</span>
          <span className="col-ctry">Country</span>
          <span style={{ textAlign: "center" }}>Implied · live</span>
          <span className="col-od" style={{ textAlign: "right" }}>
            DraftKings
          </span>
          <span style={{ textAlign: "center" }}>Trade</span>
        </div>
        {rows.map(({ market: m, parsedName, static: s }, idx) => {
          const pct = (m.yesPrice ?? 0) * 100;
          const yesCents = Math.max(1, Math.min(99, Math.round(pct)));
          const barW = maxPct > 0 ? (pct / maxPct) * 100 : 0;
          const displayName = s?.player ?? parsedName;
          const club = s?.club ?? null;
          const nation = s?.nation ?? null;

          // Resolve player visual: photo → flagcdn img → emoji flag
          const pv = resolvePlayerVisual(displayName, m.icon);
          const flagImgSrc = flagCdnUrl(nation) ?? (pv.team ? flagCdnUrl(pv.team) : null);
          const hasPhoto = pv.type === "photo" && pv.value;
          const hasFlag = !!flagImgSrc;
          const flagEmoji = !hasFlag && pv.type === "flag" ? pv.value : null;

          return (
            <div key={m.key} className="boot-r">
              <span className="rk">{(idx + 1).toString().padStart(2, "0")}</span>
              <span className="pl">
                {/* Player visual: photo > flagcdn img > emoji > initials */}
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: hasPhoto ? "50%" : 6,
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-soft)",
                    fontSize: hasPhoto || hasFlag ? undefined : 17,
                  }}
                >
                  {hasPhoto ? (
                    <img
                      src={pv.value ?? ""}
                      alt=""
                      aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : hasFlag ? (
                    <img
                      src={flagImgSrc ?? ""}
                      alt=""
                      aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : flagEmoji ? (
                    <span aria-hidden="true">{flagEmoji}</span>
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        fontFamily: "var(--f-tech)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--muted-2)",
                      }}
                    >
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span>
                  <div className="nm">{displayName}</div>
                  {club && <div className="tm">{club}</div>}
                </span>
              </span>
              <span className="ctry col-ctry">
                {/* Country column: flagcdn img preferred over text code */}
                {hasFlag ? (
                  <img
                    src={flagImgSrc ?? ""}
                    alt={nation ?? ""}
                    style={{
                      width: 28,
                      height: 20,
                      objectFit: "cover",
                      borderRadius: 3,
                      border: "1px solid var(--line-2)",
                      boxShadow: "0 0 0 1px var(--line-2)",
                    }}
                  />
                ) : flagEmoji ? (
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    {flagEmoji}
                  </span>
                ) : nation ? (
                  <span className="flagc">{nation.slice(0, 3).toUpperCase()}</span>
                ) : (
                  <span className="flagc" style={{ color: "var(--muted-2)" }}>
                    —
                  </span>
                )}
              </span>
              <span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--bg-tint)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barW}%`,
                        background: "var(--grad-brand)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--brand)",
                      width: 40,
                      textAlign: "right",
                    }}
                  >
                    {`${pct.toFixed(1)}%`}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--f-tech)",
                      fontSize: 10,
                      color: "var(--yes)",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "var(--yes)",
                        animation: "pulse 1.8s infinite",
                        display: "inline-block",
                      }}
                    />
                    {fmtVolume(m.volume)}
                  </span>
                </div>
              </span>
              <span className="od col-od">{s?.draftkings ?? "—"}</span>
              <span className="ynx">
                <button
                  type="button"
                  className="y"
                  onClick={() => handleYesNo(m, "yes")}
                  aria-label={`YES on ${displayName} Golden Boot · ${yesCents}¢`}
                >
                  YES
                  <small>{yesCents}¢</small>
                </button>
                <button
                  type="button"
                  className="n"
                  onClick={() => handleYesNo(m, "no")}
                  aria-label={`NO on ${displayName} Golden Boot · ${100 - yesCents}¢`}
                >
                  NO
                  <small>{100 - yesCents}¢</small>
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {sheet && (
        <BetSheet market={sheet.market} initialSide={sheet.side} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

import type { Match } from "@/lib/wc2026";
import { moneylineToProb } from "@/lib/wc2026";
import { teamCardSlug as cardSlug } from "@/lib/wc2026/teamCard";
import type { WcLiveMarket } from "@/lib/wc2026/usePm";
import Link from "next/link";

interface Props {
  match: Match;
  /**
   * Live Polymarket match markets keyed by `${lowerTeamName}:${isoDate}`.
   * When a match market exists for the home or away team (on this date),
   * the PM yesPrice overrides the static-derived moneyline probability.
   * Static moneyline + O/U remain as enrichment (bookie reference).
   */
  pmMap?: Record<string, WcLiveMarket>;
}

function fmtPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** Derive team accent color — approximate squad kit color. */
function teamColor(name: string): string {
  const c: Record<string, string> = {
    Brazil: "#199e43",
    France: "#11457e",
    Argentina: "#75aadb",
    England: "#cf142b",
    Spain: "#c60b1e",
    Germany: "#111111",
    Portugal: "#c8102e",
    Netherlands: "#ec5800",
    Mexico: "#199e43",
    "United States": "#3c3b6e",
    Morocco: "#c1272d",
    Japan: "#bc002d",
    Canada: "#d52b1e",
    Switzerland: "#d52b1e",
    Turkey: "#e30a17",
    Australia: "#00843d",
    Uruguay: "#5bcaff",
    Colombia: "#fcd116",
    Scotland: "#0065bf",
    Haiti: "#00209f",
    Qatar: "#8a1538",
    "South Korea": "#cd2e3a",
    "South Africa": "#c8102e",
  };
  return c[name] ?? "#2563eb";
}

const MONTH_MAP: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/**
 * Convert static "Jun 11" date format to ISO "2026-06-11" for PM market matching.
 */
function staticDateToPmDate(date: string): string | null {
  const parts = date.match(/^(\w{3})\s+(\d+)$/);
  if (!parts) return null;
  const mon = parts[1];
  const day = parts[2];
  if (!mon || !day) return null;
  const mm = MONTH_MAP[mon];
  if (!mm) return null;
  return `2026-${mm}-${day.padStart(2, "0")}`;
}

/** PM question team-name variants that differ from static data names. */
const PM_NAME_VARIANTS: Array<[string, string[]]> = [
  ["South Korea", ["Korea Republic", "South Korea"]],
  ["United States", ["United States", "USA"]],
  ["Iran", ["IR Iran", "Iran"]],
  ["Turkey", ["Türkiye", "Turkey"]],
  ["Bosnia-Herz.", ["Bosnia and Herzegovina", "Bosnia-Herz."]],
  ["Cape Verde", ["Cabo Verde", "Cape Verde"]],
  ["Ivory Coast", ["Côte d'Ivoire", "Ivory Coast"]],
  ["DR Congo", ["DR Congo", "the Democratic Republic of Congo"]],
];

function resolveVariants(teamName: string): string[] {
  for (const [key, variants] of PM_NAME_VARIANTS) {
    if (key === teamName) return variants;
  }
  return [teamName];
}

/**
 * Look up the PM market for a team on a specific match date.
 */
function findPmMarket(
  teamName: string,
  matchDate: string,
  pmMap: Record<string, WcLiveMarket> | undefined,
): WcLiveMarket | null {
  if (!pmMap) return null;
  const isoDate = staticDateToPmDate(matchDate);
  if (!isoDate) return null;

  const variants = resolveVariants(teamName);
  for (const v of variants) {
    const hit = pmMap[`${v.toLowerCase()}:${isoDate}`];
    if (hit) return hit;
  }
  return null;
}

export function MatchRow({ match, pmMap }: Props) {
  const homeProb = moneylineToProb(match.moneylineHome);
  const drawProb = moneylineToProb(match.drawTie);
  const awayProb = moneylineToProb(match.moneylineAway);
  const staticTotal = homeProb + drawProb + awayProb || 1;
  const normHomeStatic = homeProb / staticTotal;
  const normDrawStatic = drawProb / staticTotal;
  const normAwayStatic = awayProb / staticTotal;

  // PM overlays (team-win markets) — null if no live market for this team
  const homePm = findPmMarket(match.homeTeam, match.date, pmMap);
  const awayPm = findPmMarket(match.awayTeam, match.date, pmMap);

  // Use PM price where available, else static-derived
  const normHome = homePm?.yesPrice != null ? homePm.yesPrice : normHomeStatic;
  const normAway = awayPm?.yesPrice != null ? awayPm.yesPrice : normAwayStatic;

  // For draw: if we have PM win prices for both sides, infer draw as remainder
  const normDraw =
    homePm?.yesPrice != null && awayPm?.yesPrice != null
      ? Math.max(0, 1 - normHome - normAway)
      : normDrawStatic;

  const totalForBar = normHome + normDraw + normAway || 1;
  const barHome = normHome / totalForBar;
  const barDraw = normDraw / totalForBar;
  const barAway = normAway / totalForBar;

  const hasLivePm = homePm != null || awayPm != null;

  const hSlug = cardSlug(match.homeTeam);
  const aSlug = cardSlug(match.awayTeam);
  const hColor = teamColor(match.homeTeam);
  const aColor = teamColor(match.awayTeam);

  return (
    <Link
      href={`/wc/match/${match.matchNumber}`}
      className="ds4 mc"
      style={
        {
          "--hc": hColor,
          "--ac": aColor,
        } as React.CSSProperties
      }
      data-date={match.date}
      aria-label={`${match.homeTeam} vs ${match.awayTeam} · open match`}
    >
      {/* Verbatim mockup structure: character art nested inside the .side
          glow panels (wc.html matchCard template). */}
      <div className="side l">
        <div className="glow" />
        {hSlug && (
          <img className="cimg l" src={`/brand/cards/${hSlug}.jpg`} alt="" aria-hidden="true" />
        )}
      </div>
      <div className="side r">
        <div className="glow" />
        {aSlug && (
          <img className="cimg r" src={`/brand/cards/${aSlug}.jpg`} alt="" aria-hidden="true" />
        )}
      </div>
      <div className="scrim" />
      <div className="vig" />
      <div className="body">
        <div className="mtop">
          <span>#{match.matchNumber.toString().padStart(3, "0")}</span>
          <span>
            {match.date.toUpperCase()}
            {hasLivePm && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  fontFamily: "var(--f-tech)",
                  color: "var(--yes)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                PM live
              </span>
            )}
          </span>
        </div>
        <div className="teams">
          <div>
            <div className="tn">{match.homeTeam}</div>
            <div className="od h">
              {match.moneylineHome ?? "—"}
              {!homePm && match.moneylineHome && (
                <span
                  style={{
                    marginLeft: 3,
                    fontSize: 9,
                    fontFamily: "var(--f-tech)",
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                  }}
                  title="Bookie reference. No live PM market."
                >
                  ref
                </span>
              )}
            </div>
            <div className="wp h">
              {fmtPct(normHome)}
              {homePm != null && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 9,
                    fontFamily: "var(--f-tech)",
                    color: "var(--yes)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--yes)",
                      animation: "pulse 1.8s infinite",
                      display: "inline-block",
                    }}
                  />
                </span>
              )}
            </div>
          </div>
          <div className="vs">VS</div>
          <div>
            <div className="tn">{match.awayTeam}</div>
            <div className="od a">
              {match.moneylineAway ?? "—"}
              {!awayPm && match.moneylineAway && (
                <span
                  style={{
                    marginLeft: 3,
                    fontSize: 9,
                    fontFamily: "var(--f-tech)",
                    color: "var(--muted-2)",
                    textTransform: "uppercase",
                  }}
                  title="Bookie reference. No live PM market."
                >
                  ref
                </span>
              )}
            </div>
            <div className="wp a">
              {fmtPct(normAway)}
              {awayPm != null && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 9,
                    fontFamily: "var(--f-tech)",
                    color: "var(--yes)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--yes)",
                      animation: "pulse 1.8s infinite",
                      display: "inline-block",
                    }}
                  />
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="pbar">
          <i className="h" style={{ width: `${barHome * 100}%` }} />
          <i className="d" style={{ width: `${barDraw * 100}%` }} />
          <i className="a" style={{ width: `${barAway * 100}%` }} />
        </div>
        <div className="drawl">
          {match.drawTie ?? "Draw"} · {fmtPct(normDraw)}
        </div>
        <div className="foot">
          <span>{match.venue}</span>
          <span className="ou">O/U {match.overUnderGoals ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}

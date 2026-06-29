/**
 * Team → match-card art slug, matching public/brand/cards/<slug>.jpg
 * (50 mascots included in the WC2026 event module).
 * Every qualified team now has art; unknown names return null → flag fallback.
 *
 * Single source of truth — used by MatchRow, MatchDetail, and the mobile cards.
 */
const TEAM_CARD_SLUG: Record<string, string> = {
  Algeria: "algeria",
  Argentina: "argentina",
  Australia: "australia",
  Austria: "austria",
  Belgium: "belgium",
  "Bosnia-Herz.": "bosnia",
  "Bosnia and Herzegovina": "bosnia",
  Brazil: "brazil",
  Canada: "canada",
  "Cape Verde": "cape_verde",
  "Cabo Verde": "cape_verde",
  Colombia: "colombia",
  Croatia: "croatia",
  Curaçao: "curacao",
  Curacao: "curacao",
  Czechia: "czechia",
  "Czech Rep.": "czechia",
  "Czech Republic": "czechia",
  "DR Congo": "dr_congo",
  "Congo DR": "dr_congo",
  Ecuador: "ecuador",
  Egypt: "egypt",
  England: "england",
  France: "france",
  Germany: "germany",
  Ghana: "ghana",
  Haiti: "haiti",
  Iran: "iran",
  "IR Iran": "iran",
  Iraq: "iraq",
  "Ivory Coast": "ivory_coast",
  "Côte d'Ivoire": "ivory_coast",
  Japan: "japan",
  Jordan: "jordan",
  Mexico: "mexico",
  Morocco: "morocco",
  Netherlands: "netherlands",
  Norway: "norway",
  "New Zealand": "new_zealand",
  Panama: "panama",
  Paraguay: "paraguay",
  Portugal: "portugal",
  Qatar: "qatar",
  "Saudi Arabia": "saudi_arabia",
  Scotland: "scotland",
  Senegal: "senegal",
  "South Africa": "south_africa",
  "South Korea": "south_korea",
  "Korea Republic": "south_korea",
  Spain: "spain",
  Sweden: "sweden",
  Switzerland: "switzerland",
  Tunisia: "tunisia",
  Turkey: "turkey",
  Türkiye: "turkey",
  Uruguay: "uruguay",
  Uzbekistan: "uzbekistan",
  "United States": "usa",
  USA: "usa",
};

/** Card art slug for a team, or null when no mascot exists (→ flag fallback). */
export function teamCardSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  return TEAM_CARD_SLUG[name] ?? null;
}

/** Full card image src, or null. */
export function teamCardSrc(name: string | null | undefined): string | null {
  const slug = teamCardSlug(name);
  return slug ? `/brand/cards/${slug}.jpg` : null;
}

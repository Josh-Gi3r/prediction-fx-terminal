/**
 * Polymarket team name → static wc2026 dataset name.
 *
 * PM uses FIFA-style names ("Czechia", "Türkiye", "Bosnia and Herzegovina",
 * "Congo DR") while the wc2026 dataset uses short display names ("Czech Rep.",
 * "Turkey", "Bosnia-Herz.", "DR Congo"). Single source of truth — used by
 * GroupsClient, BracketClient, and any future PM↔static join. The registry
 * build script (scripts/build-pm-registry.mjs) carries the same aliases for
 * the question-text matcher; keep the two lists in sync.
 */
const PM_TO_STATIC: Record<string, string> = {
  "Bosnia and Herzegovina": "Bosnia-Herz.",
  Czechia: "Czech Rep.",
  "Czech Republic": "Czech Rep.",
  "Congo DR": "DR Congo",
  "the Democratic Republic of Congo": "DR Congo",
  "DR Congo": "DR Congo",
  Türkiye: "Turkey",
  Turkiye: "Turkey",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "IR Iran": "Iran",
  "Korea Republic": "South Korea",
  "Cabo Verde": "Cape Verde",
  "United States of America": "United States",
  USA: "United States",
};

/** Normalize a PM team name (from teamName or question text) to the static dataset name. */
export function normalizePmTeamName(teamName: string | null | undefined): string | null {
  if (!teamName) return null;
  return PM_TO_STATIC[teamName] ?? teamName;
}

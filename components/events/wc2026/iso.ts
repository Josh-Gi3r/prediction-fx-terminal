/**
 * Team → ISO country code maps for flag rendering.
 *
 * Ported from design-v2 assets/wc-data.js (ISO map) and extended to cover all
 * 48 WC2026 teams in our dataset. ISO codes feed flagcdn.com image flags
 * (https://flagcdn.com/w<size>/<iso>.png) — the design's exact flag source.
 *
 * Owned by components/wc/** — keeps the iso lookup inside the WC surface.
 */

/** Full team-name → flagcdn ISO code. England/Scotland use the gb-* subcodes. */
export const TEAM_ISO: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia-Herz.": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  Croatia: "hr",
  Curaçao: "cw",
  "Czech Rep.": "cz",
  Czechia: "cz",
  "DR Congo": "cd",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  USA: "us",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
};

/** PM question/outcome spellings that differ from our dataset's team names. */
const ISO_ALIAS: Record<string, string> = {
  "korea republic": "kr",
  türkiye: "tr",
  turkiye: "tr",
  "cote d'ivoire": "ci",
  "côte d'ivoire": "ci",
  "cabo verde": "cv",
  "bosnia and herzegovina": "ba",
  "ir iran": "ir",
  "czech republic": "cz",
};

export function teamIso(team: string | null | undefined): string | null {
  if (!team) return null;
  const direct = TEAM_ISO[team];
  if (direct) return direct;
  return ISO_ALIAS[team.toLowerCase()] ?? null;
}

/** flagcdn.com image flag URL for a team, or null when unknown. */
export function flagUrl(
  team: string | null | undefined,
  w: 20 | 40 | 80 | 160 = 40,
): string | null {
  const iso = teamIso(team);
  return iso ? `https://flagcdn.com/w${w}/${iso}.png` : null;
}

/** flagcdn URL directly from an iso code (when the iso is already known). */
export function flagUrlFromIso(
  iso: string | null | undefined,
  w: 20 | 40 | 80 | 160 = 40,
): string | null {
  return iso ? `https://flagcdn.com/w${w}/${iso}.png` : null;
}

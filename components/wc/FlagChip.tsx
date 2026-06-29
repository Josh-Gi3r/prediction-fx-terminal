/**
 * FlagChip — renders a real country flag image (flagcdn via iso.ts) for a team.
 *
 * Replaces the old text-code chips (FRA / SPA / ENG) across the WC surface
 * (Outright table, Groups, Bracket, match cards). When no ISO mapping exists
 * for a team, falls back to a compact text-code chip so the row never renders
 * blank.
 *
 * Owned by components/wc/** — styling lives in app/wc/wc-pages.css (.wc-flag).
 */

import { flagUrl } from "@/components/wc/iso";

/** Compact 2–3 letter fallback code when a team has no flag ISO mapping. */
function fallbackCode(name: string): string {
  return name.slice(0, 3).toUpperCase();
}

interface FlagChipProps {
  team: string;
  /** flagcdn image width bucket. 40 covers table/list rows crisply. */
  w?: 20 | 40 | 80 | 160;
  /** Extra class for layout-specific sizing (e.g. "bracket"). */
  className?: string;
}

export function FlagChip({ team, w = 40, className }: FlagChipProps) {
  const url = flagUrl(team, w);
  const cls = className ? `wc-flag ${className}` : "wc-flag";
  if (url) {
    return <img className={cls} src={url} alt={`${team} flag`} loading="lazy" />;
  }
  // No ISO → keep the legacy text-code chip so layout stays intact.
  return (
    <span className={`flagc${className ? ` ${className}` : ""}`} aria-hidden="true">
      {fallbackCode(team)}
    </span>
  );
}

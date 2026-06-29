#!/usr/bin/env node
/**
 * Prediction-FX × Polymarket market registry builder (phase 1 of the backend doc).
 *
 * Pulls every active World Cup event from the Gamma API (world-cup +
 * fifa-world-cup tags), denoises non-WC leakage, categorizes, joins team
 * codes / players / groups against the wc2026 dataset, applies the
 * liquidity gate, and emits lib/wc2026/pmRegistry.json.
 *
 * NON-NEGOTIABLE rule enforced here AND at the read layer: a market that
 * fails the gate is written with visible=false and is never served. We do
 * not self-seed books; thin rooms stay closed.
 *
 * Run: node scripts/build-pm-registry.mjs        (re-run nightly / pre-deploy)
 *
 * Flags:
 *   --allow-empty   Exit 0 even if Gamma is unreachable or output is empty.
 *                   Use for local bootstrapping when you are offline; the file
 *                   is written with an empty markets array so the app starts.
 *                   Never use this flag on a production deploy.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAMMA = "https://gamma-api.polymarket.com";

// ─── Liquidity gate (§3.5 of the backend doc) ────────────────────────────────
const MIN_LIQUIDITY = 5_000;
const MIN_VOLUME = 10_000;
const MAX_SPREAD = 0.08;

// ─── Denoiser ────────────────────────────────────────────────────────────────
const NOISE =
  /\b(mls|ballon|serie a|laliga|la liga|premier league|champions league|manager|next club|epl|bundesliga|ligue 1|transfer)\b/i;

// ─── Categorizer (event title → prediction-fx category) ─────────────────────────────
function categorize(title) {
  const t = title.toLowerCase();
  if (/world cup winner/.test(t)) return "champion";
  if (/continent/.test(t)) return "continent";
  if (/group [a-l] winner/.test(t)) return "group_winner";
  if (/advance to knockout/.test(t)) return "advance_ko";
  if (/reach the (round of 16|quarter|semi|final)/.test(t) || /to reach/.test(t))
    return "reach_round";
  if (/golden boot/.test(t)) return "golden_boot";
  if (/golden ball/.test(t)) return "golden_ball";
  if (/golden glove/.test(t)) return "golden_glove";
  if (/top (goalscorer|scorer)/.test(t)) return "top_scorer_nation";
  if (/most assists/.test(t)) return "assists";
  if (/goal contributions/.test(t)) return "goal_contrib";
  if (/clean sheets/.test(t)) return "clean_sheets";
  if (/player to score|to score in/.test(t)) return "player_score";
  if (/ vs\.? /.test(t)) return "match";
  return "fun";
}

// ─── Team-code resolution against the wc2026 dataset ─────────────────────────
// data.ts is generated TS; extract team names + codes + groups with a regex
// pass rather than importing TS from node.
function loadTeams() {
  const src = readFileSync(join(ROOT, "lib/wc2026/data.ts"), "utf8");
  const teams = new Map(); // lowercase name → { code, group }
  // OUTRIGHT_ODDS entries carry { team: "Mexico", group: "A" } — codes appear
  // in MATCHES as moneyline prefixes ("MEX -185"). Build name→group first.
  for (const m of src.matchAll(/"team":\s*"([^"]+)",\s*\n\s*"group":\s*"([A-L])"/g)) {
    teams.set(m[1].toLowerCase(), { name: m[1], group: m[2], code: null });
  }
  // Derive codes from match rows: homeTeam/awayTeam names + moneyline codes.
  for (const m of src.matchAll(
    /"homeTeam":\s*"([^"]+)"[\s\S]{0,300}?"moneylineHome":\s*"([A-Z]{2,3}) [+-]/g,
  )) {
    const t = teams.get(m[1].toLowerCase());
    if (t && !t.code) t.code = m[2];
  }
  for (const m of src.matchAll(
    /"awayTeam":\s*"([^"]+)"[\s\S]{0,300}?"moneylineAway":\s*"([A-Z]{2,3}) [+-]/g,
  )) {
    const t = teams.get(m[1].toLowerCase());
    if (t && !t.code) t.code = m[2];
  }
  return teams;
}

const ALIASES = new Map([
  ["usa", "united states"],
  ["united states of america", "united states"],
  ["south korea", "korea republic"],
  ["ivory coast", "côte d'ivoire"],
  ["cote d'ivoire", "côte d'ivoire"],
  ["iran", "ir iran"],
  // PM question forms → wc2026 dataset names (keep in sync with lib/wc2026/teamAlias.ts)
  ["czechia", "czech rep."],
  ["czech republic", "czech rep."],
  ["bosnia and herzegovina", "bosnia-herz."],
  ["congo dr", "dr congo"],
  ["democratic republic of congo", "dr congo"],
  ["türkiye", "turkey"],
  ["turkiye", "turkey"],
  ["cabo verde", "cape verde"],
]);

function resolveTeam(teams, question) {
  const q = question.toLowerCase();
  for (const [alias, canon] of ALIASES) {
    if (q.includes(alias) && teams.has(canon)) return teams.get(canon);
  }
  let best = null;
  for (const [name, t] of teams) {
    if (q.includes(name)) {
      if (!best || name.length > best.name.toLowerCase().length) best = t;
    }
  }
  return best;
}

function parseJsonField(v, fallback) {
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function gate(m) {
  const liq = Number(m.liquidity ?? 0);
  const vol = Number(m.volume ?? 0);
  const bid = Number(m.bestBid ?? 0);
  const ask = Number(m.bestAsk ?? 0);
  if (!m.acceptingOrders) return false;
  // Liquidity OR volume: a market with a deep book but little traded volume
  // (e.g. Golden Ball: $50k liquidity / $6k volume) is real and tradeable.
  // Polymarket shows these; the old volume-AND gate wrongly hid ~85% of props.
  if (liq < MIN_LIQUIDITY && vol < MIN_VOLUME) return false;
  // Still require a live two-sided book and a sane spread.
  if (bid <= 0 || ask <= 0 || ask - bid > MAX_SPREAD) return false;
  return true;
}

async function fetchEvents(tag) {
  const out = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(
      `${GAMMA}/events?tag_slug=${tag}&active=true&closed=false&limit=500&offset=${offset}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) throw new Error(`gamma ${tag} ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 500) return out;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let teams;
let events;

try {
  teams = loadTeams();
  events = [...(await fetchEvents("world-cup")), ...(await fetchEvents("fifa-world-cup"))];
} catch (err) {
  if (ALLOW_EMPTY) {
    console.error(
      "[build-pm-registry] Gamma unreachable, --allow-empty set — writing empty registry.",
    );
    console.error(err);
    writeFileSync(
      join(ROOT, "lib/wc2026/pmRegistry.json"),
      JSON.stringify({ builtAt: new Date().toISOString(), markets: [] }, null, 1),
    );
    process.exit(0);
  }
  console.error("[build-pm-registry] FATAL: Gamma unreachable. Deploy blocked.");
  console.error(err);
  process.exit(1);
}

const seen = new Set();
const rows = [];
let noise = 0;

for (const ev of events) {
  if (seen.has(ev.id)) continue;
  seen.add(ev.id);
  const title = ev.title ?? "";
  if (NOISE.test(title)) {
    noise++;
    continue;
  }
  const category = categorize(title);
  for (const m of ev.markets ?? []) {
    if (!m.conditionId) continue;
    const tokenIds = parseJsonField(m.clobTokenIds, []);
    if (tokenIds.length < 2) continue;
    const team = resolveTeam(teams, m.question ?? "");
    const groupMatch = title.match(/Group ([A-L])/i);
    const key = `wc:${category}:${m.conditionId.slice(2, 10)}`;
    rows.push({
      key,
      category,
      eventSlug: ev.slug ?? null,
      eventTitle: title,
      // Per-outcome label (e.g. "Kylian Mbappé", "Belgium") for multi-outcome
      // neg-risk events — what the row should show instead of the long question.
      outcomeLabel: m.groupItemTitle || null,
      question: m.question ?? "",
      // Icon/image live on the EVENT object, not the market. Market icon as
      // fallback. These are the soccer-ball composites / player photos.
      icon: m.icon ?? ev.icon ?? ev.image ?? null,
      eventImage: ev.image ?? ev.icon ?? null,
      conditionId: m.conditionId,
      yesTokenId: tokenIds[0],
      noTokenId: tokenIds[1],
      negRisk: Boolean(m.negRisk),
      tickSize: Number(m.orderPriceMinTickSize ?? 0.01),
      minOrderSize: Number(m.orderMinSize ?? 5),
      teamCode: team?.code ?? null,
      teamName: team?.name ?? null,
      groupId: groupMatch?.[1]?.toUpperCase() ?? team?.group ?? null,
      endDate: m.endDateIso ?? m.endDate ?? null,
      // Snapshot fields — refreshed live by the read API; gate recomputed there.
      snapshot: {
        yesPrice: parseJsonField(m.outcomePrices, [null])[0],
        liquidity: Number(m.liquidity ?? 0),
        volume: Number(m.volume ?? 0),
        bestBid: Number(m.bestBid ?? 0),
        bestAsk: Number(m.bestAsk ?? 0),
      },
      acceptingOrders: Boolean(m.acceptingOrders),
      visible: gate(m),
      syncedAt: new Date().toISOString(),
    });
  }
}

rows.sort((a, b) => b.snapshot.volume - a.snapshot.volume);
const visible = rows.filter((r) => r.visible);

// ─── Guard: fail the deploy if the output is empty (Gamma reachable but returned
//     nothing — e.g. API structural change, wrong tag names). Use --allow-empty
//     to bypass for local/offline development.
if (rows.length === 0 && !ALLOW_EMPTY) {
  console.error(
    "[build-pm-registry] FATAL: 0 markets fetched from Gamma — output is empty. Deploy blocked.",
  );
  console.error("  If this is intentional (offline dev), re-run with --allow-empty.");
  process.exit(1);
}

const byCategory = {};
for (const r of visible) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

writeFileSync(
  join(ROOT, "lib/wc2026/pmRegistry.json"),
  JSON.stringify({ builtAt: new Date().toISOString(), markets: rows }, null, 1),
);

console.log(`events: ${seen.size} (noise dropped: ${noise})`);
console.log(`markets: ${rows.length} total, ${visible.length} visible after gate`);
console.log("visible by category:", byCategory);
console.log(
  "team-matched:",
  rows.filter((r) => r.teamCode).length,
  "/ unmatched team-ish questions:",
  rows.filter(
    (r) =>
      !r.teamCode && ["group_winner", "advance_ko", "reach_round", "champion"].includes(r.category),
  ).length,
);

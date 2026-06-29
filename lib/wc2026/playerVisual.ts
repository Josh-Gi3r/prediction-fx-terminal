/**
 * Player market visual resolver — the fallback chain for prediction-market
 * cards/rows that show a person (Golden Boot, Golden Ball, H2H, etc.).
 *
 * Polymarket stores only ONE shared event icon for these multi-outcome
 * markets (every Golden Boot player returns the same soccer-ball image), so
 * we resolve a per-player visual ourselves:
 *
 *   1. PHOTO  — a headshot in /public/player-photos/<slug>.png (manifest below)
 *   2. FLAG   — the player's national flag emoji (always available via SQUADS)
 *   3. ICON   — the Polymarket event icon (generic ball) as last resort
 *
 * Drop new headshots in public/player-photos/ and add the slug to
 * PLAYER_PHOTOS; until then a player cleanly shows their flag.
 */

import { SQUADS } from "./data";

/** Flag emoji per WC team name (matches the 48 teams in the dataset). */
const TEAM_FLAG: Record<string, string> = {
  Algeria: "🇩🇿",
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  "Bosnia-Herz.": "🇧🇦",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  "Cape Verde": "🇨🇻",
  Colombia: "🇨🇴",
  Croatia: "🇭🇷",
  Curaçao: "🇨🇼",
  "Czech Rep.": "🇨🇿",
  "DR Congo": "🇨🇩",
  Ecuador: "🇪🇨",
  Egypt: "🇪🇬",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Ghana: "🇬🇭",
  Haiti: "🇭🇹",
  Iran: "🇮🇷",
  Iraq: "🇮🇶",
  "Ivory Coast": "🇨🇮",
  Japan: "🇯🇵",
  Jordan: "🇯🇴",
  Mexico: "🇲🇽",
  Morocco: "🇲🇦",
  Netherlands: "🇳🇱",
  "New Zealand": "🇳🇿",
  Norway: "🇳🇴",
  Panama: "🇵🇦",
  Paraguay: "🇵🇾",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  "Saudi Arabia": "🇸🇦",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Senegal: "🇸🇳",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  Tunisia: "🇹🇳",
  Turkey: "🇹🇷",
  USA: "🇺🇸",
  Uruguay: "🇺🇾",
  Uzbekistan: "🇺🇿",
};

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** name → team, built once from the squad rosters (+ a few alias spellings). */
const PLAYER_TEAM: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const p of SQUADS) map[normalize(p.playerName)] = p.team;
  // Common short/alt spellings used by Polymarket question text.
  const ALIAS: Record<string, string> = {
    "kylian mbappe": "France",
    messi: "Argentina",
    "lionel messi": "Argentina",
    ronaldo: "Portugal",
    "cristiano ronaldo": "Portugal",
    neymar: "Brazil",
    haaland: "Norway",
    "erling haaland": "Norway",
    olise: "France",
    "michael olise": "France",
    dembele: "France",
    "ousmane dembele": "France",
    "vinicius jr": "Brazil",
    "vinicius junior": "Brazil",
    "son heung-min": "South Korea",
    "heung-min son": "South Korea",
    salah: "Egypt",
    "mohamed salah": "Egypt",
    mane: "Senegal",
    "sadio mane": "Senegal",
  };
  for (const [k, v] of Object.entries(ALIAS)) map[normalize(k)] = v;
  return map;
})();

/**
 * Headshot manifest — slugs present in /public/player-photos/.
 * Add a player's normalized name here once their <slug>.png is dropped in.
 * Empty for now → everyone falls back to their flag.
 */
export const PLAYER_PHOTOS: Record<string, string> = {
  "achraf hakimi": "/player-photos/hakimi.png",
  "adam hlozek": "/player-photos/hlozek.png",
  "ajdin hrustic": "/player-photos/hrustic.png",
  "akram afif": "/player-photos/afif.png",
  "alexandre oukidja": "/player-photos/oukidja.png",
  "alexis vega": "/player-photos/vega.png",
  "alphonso davies": "/player-photos/davies.png",
  alvarez: "/player-photos/alvarez.png",
  "amad diallo": "/player-photos/diallo.png",
  "andrej kramaric": "/player-photos/kramaric.png",
  "andy robertson": "/player-photos/robertson.png",
  "antoine semenyo": "/player-photos/semenyo.png",
  "antonee robinson": "/player-photos/robinson.png",
  "arda guler": "/player-photos/guler.png",
  "aymen hussein": "/player-photos/hussein.png",
  "bart verbruggen": "/player-photos/verbruggen.png",
  bellingham: "/player-photos/bellingham.png",
  "bradley barcola": "/player-photos/barcola.png",
  "bruno fernandes": "/player-photos/fernandes.png",
  "bukayo saka": "/player-photos/saka.png",
  "cedric bakambu": "/player-photos/bakambu.png",
  "chris wood": "/player-photos/wood.png",
  "christian pulisic": "/player-photos/pulisic.png",
  "christoph baumgartner": "/player-photos/baumgartner.png",
  "cody gakpo": "/player-photos/gakpo.png",
  "cristiano ronaldo": "/player-photos/ronaldo.png",
  "dani olmo": "/player-photos/olmo.png",
  "david raya": "/player-photos/raya.png",
  "declan rice": "/player-photos/rice.png",
  "dejan kulusevski": "/player-photos/kulusevski.png",
  dembele: "/player-photos/dembele.png",
  "deniz undav": "/player-photos/undav.png",
  "depay memphis": "/player-photos/depay.png",
  "desire doue": "/player-photos/doue.png",
  "diogo costa": "/player-photos/costa.png",
  "edin dzeko": "/player-photos/dzeko.png",
  "eldor shomurodov": "/player-photos/shomurodov.png",
  "eloy room": "/player-photos/room.png",
  "emiliano martinez": "/player-photos/emiliano_martinez.png",
  "enner valencia": "/player-photos/valencia.png",
  "erling haaland": "/player-photos/haaland.png",
  "ermedin demirovic": "/player-photos/demirovic.png",
  "federico valverde": "/player-photos/valverde.png",
  "ferran torres": "/player-photos/torres.png",
  "florian wirtz": "/player-photos/wirtz.png",
  "frantzdy pierrot": "/player-photos/pierrot.png",
  gavi: "/player-photos/gavi.png",
  "gonzalo plata": "/player-photos/plata.png",
  "granit xhaka": "/player-photos/xhaka.png",
  "guillermo ochoa": "/player-photos/ochoa.png",
  haaland: "/player-photos/haaland.png",
  "hakan calhanoglu": "/player-photos/calhanoglu.png",
  "hannibal mejbri": "/player-photos/mejbri.png",
  "harry kane": "/player-photos/kane.png",
  "heung-min son": "/player-photos/son_heungmin.png",
  "igor thiago": "/player-photos/thiago.png",
  "ismael diaz": "/player-photos/ismael_diaz.png",
  "ismaila sarr": "/player-photos/sarr.png",
  "ivan perisic": "/player-photos/perisic.png",
  "jamal musiala": "/player-photos/musiala.png",
  "jasur yaxshiboyev": "/player-photos/yaxshiboyev.png",
  "jonathan david": "/player-photos/jonathan_david.png",
  "jude bellingham": "/player-photos/bellingham.png",
  "julian alvarez": "/player-photos/alvarez.png",
  "julio enciso": "/player-photos/enciso.png",
  "julio tavares": "/player-photos/tavares.png",
  "kaoru mitoma": "/player-photos/mitoma.png",
  "kevin de bruyne": "/player-photos/bruyne.png",
  "kylian mbappe": "/player-photos/mbappe.png",
  "lamine yamal": "/player-photos/yamal.png",
  "lautaro martinez": "/player-photos/lautaro_martinez.png",
  "leandro bacuna": "/player-photos/bacuna.png",
  "liberato cacace": "/player-photos/cacace.png",
  "lionel messi": "/player-photos/messi.png",
  "luis diaz": "/player-photos/luis_diaz.png",
  "luis javier suarez": "/player-photos/suarez.png",
  "luka modric": "/player-photos/modric.png",
  "lyle foster": "/player-photos/foster.png",
  mane: "/player-photos/mane.png",
  "marcel sabitzer": "/player-photos/sabitzer.png",
  "marcus thuram": "/player-photos/thuram.png",
  "martin boyle": "/player-photos/boyle.png",
  "martin odegaard": "/player-photos/odegaard.png",
  "mathew ryan": "/player-photos/ryan.png",
  "matt freese": "/player-photos/freese.png",
  "matt turner": "/player-photos/turner.png",
  "mehdi taremi": "/player-photos/taremi.png",
  "meshaal barsham": "/player-photos/barsham.png",
  messi: "/player-photos/messi.png",
  "michael olise": "/player-photos/olise.png",
  "miguel almiron": "/player-photos/almiron.png",
  "mikel oyarzabal": "/player-photos/oyarzabal.png",
  "mohamed salah": "/player-photos/salah.png",
  "mohammed kudus": "/player-photos/kudus.png",
  "mouez hassen": "/player-photos/hassen.png",
  "musa al-taamari": "/player-photos/al-taamari.png",
  neymar: "/player-photos/neymar.png",
  "noah okafor": "/player-photos/okafor.png",
  olise: "/player-photos/olise.png",
  "oliver baumann": "/player-photos/baumann.png",
  "ondrej duda": "/player-photos/duda.png",
  "orjan nyland": "/player-photos/nyland.png",
  "ousmane dembele": "/player-photos/dembele.png",
  pedri: "/player-photos/pedri.png",
  "percy tau": "/player-photos/tau.png",
  "rafael leao": "/player-photos/leao.png",
  raphinha: "/player-photos/raphinha.png",
  "rayan cherki": "/player-photos/cherki.png",
  "riyad mahrez": "/player-photos/mahrez.png",
  "robin olsen": "/player-photos/olsen.png",
  rodri: "/player-photos/rodri.png",
  "rodrigo de paul": "/player-photos/paul.png",
  rodrygo: "/player-photos/rodrygo.png",
  "romelu lukaku": "/player-photos/lukaku.png",
  ronaldo: "/player-photos/ronaldo.png",
  "sadio mane": "/player-photos/mane.png",
  salah: "/player-photos/salah.png",
  "salem al-dawsari": "/player-photos/al-dawsari.png",
  "santiago gimenez": "/player-photos/gimenez.png",
  "scott mctominay": "/player-photos/mctominay.png",
  "sebastien haller": "/player-photos/haller.png",
  "senne lammens": "/player-photos/lammens.png",
  "simon adingra": "/player-photos/adingra.png",
  "son heung-min": "/player-photos/son_heungmin.png",
  "thibaut courtois": "/player-photos/courtois.png",
  "viktor gyokeres": "/player-photos/gyokeres.png",
  "vinicius jr.": "/player-photos/vinicius_junior.png",
  "vinicius junior": "/player-photos/vinicius_junior.png",
  vitinha: "/player-photos/vitinha.png",
  vozinha: "/player-photos/vozinha.png",
  "xavi simons": "/player-photos/simons.png",
  "yann sommer": "/player-photos/sommer.png",
  "yassine bounou": "/player-photos/bounou.png",
  "youssef en-nesyri": "/player-photos/en-nesyri.png",
};

export interface PlayerVisual {
  type: "photo" | "flag" | "icon";
  /** photo: image src · flag: emoji · icon: fall through to the PM event icon */
  value: string | null;
  team: string | null;
}

/**
 * Resolve the visual for a player-named market outcome.
 * `fallbackIcon` is the Polymarket event icon (passed from the market) used
 * only when we have neither a photo nor a known nation.
 */
export function resolvePlayerVisual(
  playerName: string | null | undefined,
  fallbackIcon?: string | null,
): PlayerVisual {
  if (!playerName) return { type: "icon", value: fallbackIcon ?? null, team: null };
  const n = normalize(playerName);
  const photo = PLAYER_PHOTOS[n];
  const team = PLAYER_TEAM[n] ?? null;
  if (photo) return { type: "photo", value: photo, team };
  if (team && TEAM_FLAG[team]) return { type: "flag", value: TEAM_FLAG[team], team };
  return { type: "icon", value: fallbackIcon ?? null, team };
}

export function teamFlag(team: string | null | undefined): string | null {
  return team ? (TEAM_FLAG[team] ?? null) : null;
}

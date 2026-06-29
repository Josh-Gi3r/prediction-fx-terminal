// Static seed data for the mobile shell.
// WC match data mirrors the mockup exactly.
// FX corridors are display-only seeds (live rates come from hooks).

export interface WcMatch {
  n: number;
  date: string;
  h: string;
  a: string;
  hc: string;
  ac: string;
  ph: number;
  pd: number;
  pa: number;
  ho?: string;
  ao?: string;
  dr?: string;
  venue?: string;
  ou?: string;
  round?: string;
  hc3?: string;
  ac3?: string;
  time?: string;
  cd?: string;
  vol?: string;
  traders?: string;
  liq?: string;
  featured?: boolean;
}

export const FEATURED: WcMatch = {
  n: 49,
  date: "Jul 11",
  time: "8:00 PM",
  h: "Brazil",
  a: "France",
  hc3: "BRA",
  ac3: "FRA",
  ph: 54,
  pd: 24,
  pa: 22,
  ho: "BRA 1.85",
  dr: "3.40",
  ao: "FRA 2.75",
  hc: "#199e43",
  ac: "#1d4ed8",
  venue: "MetLife Stadium · New York/NJ",
  round: "Quarter Finals",
  vol: "$19.32M",
  traders: "4,892",
  liq: "High",
  featured: true,
  cd: "02:18:47",
};

export const WC_MATCHES: WcMatch[] = [
  {
    n: 1,
    date: "Jun 11",
    h: "Mexico",
    ho: "MEX -185",
    a: "South Africa",
    ao: "RSA +550",
    ph: 61,
    pd: 24,
    pa: 14,
    dr: "+285",
    hc: "#199e43",
    ac: "#c8102e",
    venue: "Estadio Banorte, Mexico City",
    ou: "2.5",
    round: "Group A",
  },
  {
    n: 2,
    date: "Jun 11",
    h: "Canada",
    ho: "CAN -130",
    a: "Bosnia-Herz.",
    ao: "BIH +400",
    ph: 55,
    pd: 26,
    pa: 19,
    dr: "+280",
    hc: "#d52b1e",
    ac: "#1f4ba0",
    venue: "BMO Field, Toronto",
    ou: "2.5",
    round: "Group B",
  },
  {
    n: 3,
    date: "Jun 11",
    h: "United States",
    ho: "USA -105",
    a: "Paraguay",
    ao: "PAR +320",
    ph: 49,
    pd: 28,
    pa: 23,
    dr: "+240",
    hc: "#3c3b6e",
    ac: "#d52b1e",
    venue: "SoFi Stadium, Los Angeles",
    ou: "2.5",
    round: "Group D",
  },
  {
    n: 4,
    date: "Jun 12",
    h: "South Korea",
    ho: "SKO +300",
    a: "Czechia",
    ao: "CZE +165",
    ph: 27,
    pd: 33,
    pa: 41,
    dr: "+230",
    hc: "#cd2e3a",
    ac: "#11457e",
    venue: "Estadio Akron, Guadalajara",
    ou: "2.5",
    round: "Group A",
  },
  {
    n: 5,
    date: "Jun 12",
    h: "Qatar",
    ho: "QAT +850",
    a: "Switzerland",
    ao: "SUI -380",
    ph: 10,
    pd: 18,
    pa: 73,
    dr: "+425",
    hc: "#8a1538",
    ac: "#d52b1e",
    venue: "Levi's Stadium, San Francisco",
    ou: "2.5",
    round: "Group B",
  },
  {
    n: 6,
    date: "Jun 12",
    h: "Brazil",
    ho: "BRA -160",
    a: "Morocco",
    ao: "MAR +450",
    ph: 58,
    pd: 25,
    pa: 17,
    dr: "+270",
    hc: "#199e43",
    ac: "#c1272d",
    venue: "MetLife Stadium, New York/NJ",
    ou: "2.5",
    round: "Group C",
  },
  {
    n: 7,
    date: "Jun 13",
    h: "France",
    ho: "FRA -220",
    a: "Norway",
    ao: "NOR +600",
    ph: 64,
    pd: 22,
    pa: 14,
    dr: "+300",
    hc: "#11457e",
    ac: "#ba0c2f",
    venue: "AT&T Stadium, Dallas",
    ou: "2.5",
    round: "Group I",
  },
  {
    n: 8,
    date: "Jun 13",
    h: "Spain",
    ho: "ESP -250",
    a: "Uruguay",
    ao: "URU +650",
    ph: 66,
    pd: 21,
    pa: 13,
    dr: "+310",
    hc: "#c60b1e",
    ac: "#5bcaff",
    venue: "Hard Rock Stadium, Miami",
    ou: "2.5",
    round: "Group H",
  },
  {
    n: 9,
    date: "Jun 13",
    h: "Haiti",
    ho: "HAI +900",
    a: "Scotland",
    ao: "SCO -280",
    ph: 10,
    pd: 18,
    pa: 72,
    dr: "+430",
    hc: "#00209f",
    ac: "#0065bf",
    venue: "Gillette Stadium, Boston",
    ou: "2.5",
    round: "Group C",
  },
  {
    n: 10,
    date: "Jun 14",
    h: "Australia",
    ho: "AUS +275",
    a: "Turkey",
    ao: "TUR -130",
    ph: 24,
    pd: 26,
    pa: 51,
    dr: "+250",
    hc: "#00843d",
    ac: "#e30a17",
    venue: "BC Place, Vancouver",
    ou: "2.5",
    round: "Group D",
  },
  {
    n: 11,
    date: "Jun 14",
    h: "Germany",
    ho: "GER -6000",
    a: "Curaçao",
    ao: "CUR +5000",
    ph: 94,
    pd: 4,
    pa: 2,
    dr: "+2500",
    hc: "#111",
    ac: "#003da5",
    venue: "NRG Stadium, Houston",
    ou: "4.5",
    round: "Group E",
  },
  {
    n: 12,
    date: "Jun 14",
    h: "England",
    ho: "ENG -300",
    a: "Panama",
    ao: "PAN +750",
    ph: 69,
    pd: 20,
    pa: 11,
    dr: "+320",
    hc: "#cf142b",
    ac: "#005293",
    venue: "Lincoln Financial Field, Philly",
    ou: "2.5",
    round: "Group L",
  },
  {
    n: 13,
    date: "Jun 15",
    h: "Argentina",
    ho: "ARG -240",
    a: "Iraq",
    ao: "IRQ +700",
    ph: 65,
    pd: 22,
    pa: 13,
    dr: "+305",
    hc: "#75aadb",
    ac: "#007a3d",
    venue: "Mercedes-Benz Stadium, Atlanta",
    ou: "2.5",
    round: "Group J",
  },
  {
    n: 14,
    date: "Jun 15",
    h: "Portugal",
    ho: "POR -200",
    a: "Colombia",
    ao: "COL +480",
    ph: 60,
    pd: 24,
    pa: 16,
    dr: "+285",
    hc: "#c8102e",
    ac: "#fcd116",
    venue: "Arrowhead Stadium, Kansas City",
    ou: "2.5",
    round: "Group K",
  },
  {
    n: 15,
    date: "Jun 15",
    h: "Netherlands",
    ho: "NED -170",
    a: "Japan",
    ao: "JPN +430",
    ph: 57,
    pd: 26,
    pa: 17,
    dr: "+275",
    hc: "#ec5800",
    ac: "#bc002d",
    venue: "Lumen Field, Seattle",
    ou: "2.5",
    round: "Group F",
  },
];

export const MATCH_DATES = ["Jun 11", "Jun 12", "Jun 13", "Jun 14", "Jun 15"];

export const TEAMS: [string, string, string, string, number][] = [
  ["France", "FRA", "I", "+500", 18],
  ["Spain", "ESP", "H", "+500", 16],
  ["England", "ENG", "L", "+600", 13],
  ["Brazil", "BRA", "C", "+800", 10],
  ["Argentina", "ARG", "J", "+800", 9],
  ["Portugal", "POR", "K", "+1000", 6],
  ["Germany", "GER", "E", "+1200", 5],
  ["Netherlands", "NED", "F", "+2000", 4],
  ["Norway", "NOR", "I", "+2500", 3],
  ["Belgium", "BEL", "G", "+4000", 2],
  ["Colombia", "COL", "K", "+5000", 1],
  ["Uruguay", "URU", "H", "+6500", 1],
  ["Mexico", "MEX", "A", "+8000", 1],
  ["USA", "USA", "D", "+8000", 1],
];

export const GROUPS: Record<string, [string, string, number, string][]> = {
  A: [
    ["Mexico", "MEX", 6, "-160"],
    ["South Korea", "SKO", 4, "+120"],
    ["South Africa", "RSA", 1, "+260"],
    ["Czechia", "CZE", 1, "+240"],
  ],
  B: [
    ["Switzerland", "SUI", 6, "-180"],
    ["Canada", "CAN", 4, "+135"],
    ["Qatar", "QAT", 1, "+500"],
    ["Bosnia-Herz.", "BIH", 1, "+280"],
  ],
  C: [
    ["Brazil", "BRA", 7, "-450"],
    ["Morocco", "MAR", 4, "+140"],
    ["Scotland", "SCO", 2, "+320"],
    ["Haiti", "HAI", 0, "+800"],
  ],
  D: [
    ["USA", "USA", 6, "-150"],
    ["Turkey", "TUR", 4, "+125"],
    ["Australia", "AUS", 3, "+200"],
    ["Paraguay", "PAR", 1, "+360"],
  ],
  E: [
    ["Germany", "GER", 7, "-500"],
    ["Ecuador", "ECU", 4, "+150"],
    ["Ivory Coast", "CIV", 2, "+300"],
    ["Curaçao", "CUR", 0, "+1200"],
  ],
  F: [
    ["Netherlands", "NED", 6, "-200"],
    ["Japan", "JPN", 4, "+130"],
    ["Sweden", "SWE", 2, "+280"],
    ["Tunisia", "TUN", 1, "+400"],
  ],
  G: [
    ["Belgium", "BEL", 6, "-170"],
    ["Egypt", "EGY", 4, "+150"],
    ["Iran", "IRN", 2, "+260"],
    ["New Zealand", "NZL", 1, "+650"],
  ],
  H: [
    ["Spain", "ESP", 7, "-600"],
    ["Uruguay", "URU", 4, "+135"],
    ["Saudi Arabia", "KSA", 1, "+450"],
    ["Cape Verde", "CPV", 1, "+700"],
  ],
  I: [
    ["France", "FRA", 7, "-550"],
    ["Norway", "NOR", 4, "+140"],
    ["Senegal", "SEN", 2, "+300"],
    ["Iraq", "IRQ", 0, "+900"],
  ],
  J: [
    ["Argentina", "ARG", 7, "-500"],
    ["Austria", "AUT", 4, "+150"],
    ["Algeria", "ALG", 2, "+280"],
    ["Jordan", "JOR", 0, "+1000"],
  ],
  K: [
    ["Portugal", "POR", 6, "-220"],
    ["Colombia", "COL", 4, "+130"],
    ["Uzbekistan", "UZB", 2, "+320"],
    ["DR Congo", "COD", 1, "+500"],
  ],
  L: [
    ["England", "ENG", 7, "-450"],
    ["Croatia", "CRO", 4, "+135"],
    ["Ghana", "GHA", 2, "+300"],
    ["Panama", "PAN", 0, "+800"],
  ],
};

export const BRACKET = {
  qf: {
    label: "Quarter-finals · Jul 11–12",
    ties: [
      [
        ["BRA", "Brazil", 58, true],
        ["MAR", "Morocco", 42, false],
      ],
      [
        ["FRA", "France", 47, false],
        ["ARG", "Argentina", 53, true],
      ],
      [
        ["ENG", "England", 61, true],
        ["POR", "Portugal", 39, false],
      ],
      [
        ["NED", "Netherlands", 45, false],
        ["GER", "Germany", 55, true],
      ],
    ],
  },
  sf: {
    label: "Semi-finals · Jul 15–16",
    ties: [
      [
        ["BRA", "Brazil", 52, true],
        ["ARG", "Argentina", 48, false],
      ],
      [
        ["ENG", "England", 49, false],
        ["GER", "Germany", 51, true],
      ],
    ],
  },
  fin: {
    label: "Final · Jul 19",
    ties: [
      [
        ["BRA", "Brazil", 54, true],
        ["GER", "Germany", 46, false],
      ],
    ],
  },
  champ: { code: "BRA", name: "Brazil", pct: 10 },
};

export const BOOT: [string, string, string, number, string, number][] = [
  ["K. Mbappé", "Real Madrid", "FRA", 8, "+450", 22],
  ["E. Haaland", "Man City", "NOR", 7, "+500", 18],
  ["H. Kane", "Bayern München", "ENG", 7, "+600", 15],
  ["Vinícius Jr", "Real Madrid", "BRA", 6, "+750", 12],
  ["L. Martínez", "Inter", "ARG", 6, "+800", 11],
  ["L. Yamal", "Barcelona", "ESP", 5, "+1000", 9],
  ["J. Musiala", "Bayern München", "GER", 5, "+1200", 8],
  ["C. Gakpo", "Liverpool", "NED", 4, "+1600", 6],
  ["C. Ronaldo", "Al Nassr", "POR", 4, "+1800", 5],
  ["Son Heung-min", "Tottenham", "SKO", 4, "+2500", 4],
];

export interface Corridor {
  ccy: string;
  pair: string;
  name: string;
  price: string;
  chg: number;
  q: string;
  yes: number;
  cat: string;
}

export const COR: Corridor[] = [
  {
    ccy: "EUR",
    pair: "USDC/EURC",
    name: "Euro · Circle",
    price: "0.9265",
    chg: 0.12,
    q: "EUR/USD settle below 0.9265",
    yes: 44,
    cat: "Majors",
  },
  {
    ccy: "JPY",
    pair: "USDC/JPYC",
    name: "Japanese Yen · JPYC",
    price: "150.43",
    chg: 0.31,
    q: "JPY/USD settle below 150.43",
    yes: 44,
    cat: "Majors",
  },
  {
    ccy: "GBP",
    pair: "USDC/TGBP",
    name: "British Pound · TrueGBP",
    price: "0.7892",
    chg: -0.04,
    q: "GBP/USD settle below 0.7892",
    yes: 45,
    cat: "Majors",
  },
  {
    ccy: "SGD",
    pair: "USDC/XSGD",
    name: "Singapore Dollar · StraitsX",
    price: "1.3429",
    chg: 0.08,
    q: "SGD/USD settle below 1.3429",
    yes: 45,
    cat: "Majors",
  },
  {
    ccy: "BRL",
    pair: "USDC/BRLV",
    name: "Brazilian Real · Transfero",
    price: "5.1234",
    chg: -0.18,
    q: "BRL/USD settle below 5.1234",
    yes: 44,
    cat: "LatAm",
  },
  {
    ccy: "MXN",
    pair: "USDC/MXNB",
    name: "Mexican Peso · Bitso",
    price: "18.4520",
    chg: 0.22,
    q: "MXN/USD settle below 18.452",
    yes: 44,
    cat: "LatAm",
  },
  {
    ccy: "IDR",
    pair: "USDC/IDRT",
    name: "Indonesian Rupiah · Rupiah Token",
    price: "15728.00",
    chg: -0.05,
    q: "IDR/USD settle below 15728.00",
    yes: 44,
    cat: "Asia",
  },
  {
    ccy: "INR",
    pair: "USDC/INRX",
    name: "Indian Rupee",
    price: "83.6200",
    chg: 0.06,
    q: "INR/USD settle below 83.620",
    yes: 45,
    cat: "Asia",
  },
  {
    ccy: "MYR",
    pair: "USDC/MYR",
    name: "Malaysian Ringgit · MYR Token",
    price: "4.6198",
    chg: 0.03,
    q: "MYR/USD settle below 4.6198",
    yes: 45,
    cat: "Asia",
  },
  {
    ccy: "ZAR",
    pair: "USDC/ZARP",
    name: "South African Rand",
    price: "18.7400",
    chg: -0.31,
    q: "ZAR/USD settle below 18.740",
    yes: 43,
    cat: "EMEA",
  },
  {
    ccy: "TRY",
    pair: "USDC/TRYB",
    name: "Turkish Lira · BiLira",
    price: "34.2700",
    chg: 0.74,
    q: "TRY/USD settle below 34.270",
    yes: 39,
    cat: "EMEA",
  },
  {
    ccy: "NGN",
    pair: "USDC/CNGN",
    name: "Nigerian Naira · Convexity",
    price: "1620.50",
    chg: -0.42,
    q: "NGN/USD settle below 1620.50",
    yes: 37,
    cat: "Exotic",
  },
];

export const TRADE_CATS = ["all", "Majors", "LatAm", "Asia", "EMEA", "Exotic"];
export const LEV: Record<string, number> = {
  Majors: 100,
  LatAm: 50,
  Asia: 50,
  EMEA: 25,
  Exotic: 20,
};

export function sparkPath(seed: number, up: boolean, w: number, h: number): string {
  let x = (seed * 9301) % 233280;
  const n = 18;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    pts.push(x / 233280);
  }
  const base = up
    ? pts.map((v, i) => v * 0.5 + (i / n) * 0.5)
    : pts.map((v, i) => v * 0.5 + (1 - i / n) * 0.5);
  const step = w / (n - 1);
  return base
    .map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(h - v * h * 0.86 - 3).toFixed(1)}`)
    .join(" ");
}

export function matchMarkets(m: (typeof WC_MATCHES)[0]) {
  return [
    {
      q: `Match Winner · ${m.h} vs ${m.a}`,
      sub: "Resolves on official match result · 90 min + ET",
      yesL: m.h,
      yes: m.ph,
      no: 100 - m.ph,
    },
    {
      q: `${m.h} to win`,
      sub: `Binary · YES if ${m.h} wins in regulation`,
      yesL: "YES",
      yes: m.ph,
      no: 100 - m.ph,
    },
    {
      q: "Over 2.5 total goals",
      sub: "Total goals scored in regulation",
      yesL: "OVER",
      yes: 47,
      no: 53,
    },
    { q: "Both teams to score", sub: "Each side scores ≥ 1 goal", yesL: "YES", yes: 58, no: 42 },
    { q: `${m.a} clean sheet`, sub: `${m.a} concedes zero goals`, yesL: "YES", yes: 31, no: 69 },
  ];
}

export function amImplied(od: string): number {
  const n = Number.parseInt(String(od).replace("+", ""), 10);
  if (Number.isNaN(n)) return 50;
  const p = n < 0 ? -n / (-n + 100) : 100 / (n + 100);
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}

export const tvlLabel = (t: number) =>
  t >= 1e9 ? `$${(t / 1e9).toFixed(1)}B` : `$${(t / 1e6).toFixed(0)}M`;

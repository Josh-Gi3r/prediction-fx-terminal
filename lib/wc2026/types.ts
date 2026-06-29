/**
 * World Cup 2026 — typed dataset
 *
 * Source of truth: _reference/WC2026_Prediction_Market_Master.xlsx
 * Regenerate: `bun run data:wc2026`
 */

export type GroupId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type Stage =
  | "Group Stage MD1"
  | "Group Stage MD2"
  | "Group Stage MD3"
  | "Round of 32"
  | "Round of 16"
  | "Quarter-finals"
  | "Semi-finals"
  | "Third place"
  | "Final"
  | string; // permissive — covers any variant in the source

export interface Match {
  matchNumber: number;
  stage: Stage;
  date: string; // e.g. "Jun 11"
  group: GroupId | null; // null for knockout
  homeTeam: string;
  awayTeam: string;
  venue: string;
  moneylineHome: string | null;
  drawTie: string | null;
  moneylineAway: string | null;
  overUnderGoals: string | null;
}

export interface OutrightOdds {
  team: string;
  group: GroupId | null;
  draftkings: string | null;
  betmgm: string | null;
  fanduel: string | null;
  bet365: string | null;
  sportsbetAU: string | null;
  williamHill: string | null;
  polymarketPct: string | null; // raw "18%"
  kalshiImplied: string | null;
}

export interface KnockoutOdds {
  team: string;
  group: GroupId | null;
  toWin: string | null;
  toReachFinal: string | null;
  toReachSemis: string | null;
  toReachQF: string | null;
  toReachR16: string | null;
  outInGroups: string | null;
  draftkingsWin: string | null;
  polymarketWinPct: string | null;
}

export interface GroupOdds {
  group: GroupId;
  team: string;
  fanduelWinGroup: string | null;
  polymarketWinPct: string | null;
  toQualifyTop2: string | null;
  draftkingsQualifyPct: string | null;
  thirdPlaceAdvancePct: string | null;
  eliminatedInGroupsPct: string | null;
}

export interface PlayerOdds {
  player: string;
  nation: string;
  position: string;
  club: string;
  draftkings: string | null;
  sportsbetAU: string | null;
  oddscheckerUK: string | null;
  kalshiImplied: string | null;
}

export interface PredictionMarket {
  category: string;
  marketName: string;
  platform: string;
  currentOdds: string;
  volume: string | null;
  notes: string | null;
}

export interface SquadPlayer {
  group: GroupId;
  team: string;
  jersey: number | null;
  position: string;
  playerName: string;
  age: number | null;
  caps: number | null;
  goals: number | null;
  club: string;
}

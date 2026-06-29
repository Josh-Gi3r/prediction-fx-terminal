# FX Terminal design migration — spec for all page work

Source of truth: `<your-design-assets-dir>` (per-page HTML mockups +
`assets/fx-terminal.css`). Tokens already live in `app/globals.css` (`:root`) and
the scoped component layer in `app/design.css` (`.ds4` wrapper class — every
migrated page puts `ds4` on its root element). Fonts (Sora/Manrope/Chakra
Petch) load via next/font in `app/layout.tsx` as `--f-display/--f-body/--f-tech`.
Brand assets: `public/brand/` (logo.png, logo-white.png, heroes/, cards/, bg/).

## The visual system (from the drop)

- LIGHT theme: white surfaces (`--bg`), soft blue tints (`--bg-soft`,
  `--bg-tint`, `--grad-sky`), deep navy reserved for footer/dark sections
  (`--bg-deep`).
- Brand: electric royal blue `--brand:#2563eb`, mint accent `--accent:#10d9a0`.
- Market semantics: `--yes:#13b981` / `--no:#f0436a` (+ `-soft` washes).
- Type: Sora 800 for display/headlines, Manrope for body, Chakra Petch for
  tabular/technical numbers.
- Radii 10/16/22/28, layered soft shadows (`--sh-1..3`, `--sh-brand`).
- Match the mockup HTML structure closely — paddings, card grids, stat strips,
  eyebrow labels (`.eyebrow` + tick), hero composition.

## COPY RULES (non-negotiable — from Josh, 2026-06-10)

1. **FX Terminal is NOT a FX Provider product.** Remove every "FX Provider" from brand,
   marketing, and explanatory copy: no "Built on FX settlement provider", no "powered
   by the FX provider", no "through FX Provider", no "one settlement vault", no "FX Provider-supported
   stablecoin", no "via the FX provider" stat sublabels, no legal "interface to the FX provider
   Protocol".
   Replacements that keep the meaning: "settled onchain", "atomic onchain
   settlement", "one collateral vault", "your stablecoin of choice",
   "self-custodial".
2. **The ONE place FX Provider may appear: venue lists.** Where execution venues are
   named side by side (the Swap desk comparison: FX Provider / LiFi / Kyber / CoW;
   the Markets venue column), "FX Provider" stays as a neutral venue label — same
   weight as the others, never highlighted as "ours".
3. **Fix the broken/awkward English** in the mockups. Tone: confident,
   concrete, plain. No hype words, no "revolutionary", no exclamation marks.
   If a mockup sentence is grammatically off, rewrite it cleanly rather than
   copying it verbatim.
4. **Polymarket content must be REAL.** The WC surfaces are wired to live
   data (`lib/wc2026/usePm.ts` → `/api/wc/*`, liquidity-gated server-side).
   Use those hooks for any number shown. Never invent volumes, odds, trader
   counts, or APYs. Static bookie odds from `lib/wc2026/data.ts` may remain
   as comparison color only. Markets that don't pass the gate are simply not
   shown — no fake depth, no placeholder books presented as real.
5. **No fake interactivity.** A button that doesn't do the thing yet says so
   (info toast / "soon" label), never a success state.

## Functional rules

- Restyle, don't rewire: every existing hook, signing flow, and API call
  stays exactly as is. If a mockup implies a feature that doesn't exist yet,
  render the honest disabled/soon state.
- Pages opt into the new system with `className="ds4 ..."` on the root and
  may use design.css classes + Tailwind utilities together. Don't import
  legacy dark `--color-*` vars in migrated pages.
- Keep accessibility: button types, focus states, aria labels — biome rules
  are enforced (`bun run lint` must pass).
- Every page must pass: `bunx tsc --noEmit`, `bun run lint`, `bun run build`.

## Page → mockup map

| Route | Mockup | Notes |
|---|---|---|
| `/` | `index.html` | hero (public/brand/heroes), stat strip, 3 product tiles, WC preview |
| `/wc` + boot/bracket/groups/matches | `wc.html`, `wc-boot.html`, `wc-bracket.html`, `wc-groups.html`, `wc-matches.html` | live PM data; bg images in public/brand/bg, team cards in public/brand/cards |
| `/swap` | `swap.html` | 4-desk comparison; FX Provider = one venue label (rule 2) |
| `/markets` | `markets.html` | venue column may name FX Provider (rule 2) |
| `/earn` | `earn.html` | real Aave/Pendle/HLP/yields/VL surfaces only |
| `/trade`, `/trade/pro` | `trade.html` | forwards/perps; perps stay waitlist-honest |
| `/portfolio` | `portfolio.html` | balances + positions + DeFi |
| `/cash` | `p2p.html` | Peer ramp (flag-gated) |

Mobile app JSX files (`app-screens-*.jsx`, `FX Terminal Mobile App.html`) are a
LATER phase — ignore for the web migration.

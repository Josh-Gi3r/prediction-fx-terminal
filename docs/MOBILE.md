# FX Terminal Mobile App

## Architecture

The mobile experience is a standalone client-side shell that renders at `<640px` viewport width.

### Entry points

| Path | Purpose |
|------|---------|
| `/mobile` | Standalone route — renders at any viewport (for testing on desktop) |
| Any route on a narrow viewport | `MobileGate` in `app/layout.tsx` intercepts and renders `MobileApp` |

### Key files

```
components/
  MobileGate.tsx          — Client component: swaps desktop layout for MobileApp at <640px
  mobile/
    MobileApp.tsx         — Shell: tab state, nav, betslip sheet, QA fab, toast
    BetSlip.tsx           — Bottom-sheet bet confirmation component
    Icon.tsx              — SVG icon set (24px viewBox)
    primitives.tsx        — Shared UI: MobileLogo, Flag, FeaturedCard, MatchCardCompact/Full
    data.ts               — Static seed data: WcMatch[], COR[], YIELD_POOLS etc.
    screens/
      HomeScreen.tsx      — Home: balance, WC featured, products, FX corridors
      WorldCupScreen.tsx  — Predict WC: outright, groups, matches, bracket, golden boot
      MatchDetailScreen.tsx — Match detail overlay (pushed from Home / WC)
      TradeScreen.tsx     — FX Markets: heatmap, perps/deliverable
      SwapScreen.tsx      — Swap FX: multi-desk, uses lib/desks/* live hooks
      EarnScreen.tsx      — Earn: VL (FX Provider) maker, Aave lending, Pendle, yield explorer
      P2PScreen.tsx       — P2P Cash: buy/sell/send, vault delegation
      PortfolioScreen.tsx — Portfolio: positions, yield, transfers

app/
  mobile.css              — All mobile CSS scoped under .m4s
  mobile/page.tsx         — Standalone /mobile route
  globals.css             — +MobileGate pre-hydration CSS at bottom
  layout.tsx              — MobileGate wraps children
```

### Navigation model

5 bottom tabs + centre FAB:

| Tab | Icon | Screen |
|-----|------|--------|
| Home | home | HomeScreen |
| Predict WC | cup | WorldCupScreen |
| [FAB] | plus | Quick-action overlay (Swap / Earn / FX Markets / P2P) |
| FX Markets | trade | TradeScreen |
| P2P | cash | P2PScreen |
| Portfolio | wallet | PortfolioScreen |

Swap and Earn are reachable as overlays from any tab (via FAB or HomeScreen shortcuts), not top-level tabs. Match detail is a push from Home or Predict WC.

### Live hooks wired

- `SwapScreen` — `lib/desks/useSwap`, `lib/desks/hooks` (useTokens, useConfig), `lib/desks/currency`
- `PortfolioScreen` — `lib/desks/hooks` (useTokens), `lib/desks/currency`, `wagmi` useAccount
- All other screens — static seed data + local state (no external calls)

### Type fixes (from prior incomplete agent)

- `WcMatch` interface added to `data.ts` — covers both `WC_MATCHES` items and the richer `FEATURED` object
- `FxToken.rate` / `FxToken.dex` references removed from `SwapScreen` (fields don't exist on the type)
- `P2PScreen` — non-null assertions on `PLAT[key]` lookups (static data, always valid)
- `EarnScreen` / `WorldCupScreen` — `setSeg(k ?? fallback)` for tuple destructure returning `string | undefined`
- `primitives.tsx` `codeOf` — `split()[0] ?? ""` to match `string` return type

## Screens: shipped vs deferred

| Screen | Status | Notes |
|--------|--------|-------|
| HomeScreen | Shipped | Balance, WC featured, product tiles, FX corridor list |
| WorldCupScreen | Shipped | 5 segments: outright / groups / matches / bracket / golden boot |
| MatchDetailScreen | Shipped | Full market list, betslip integration |
| TradeScreen | Shipped | FX heatmap, deliverable + perp toggle |
| SwapScreen | Shipped | Multi-desk with live token list, quote display |
| EarnScreen | Shipped | VL maker, Aave lending, Pendle fixed, yield explorer |
| P2PScreen | Shipped | Buy / sell / send modes, vault delegation, analytics |
| PortfolioScreen | Shipped | Live account, yield positions, transfers |

No screens deferred. All 8 screens ship in this commit.

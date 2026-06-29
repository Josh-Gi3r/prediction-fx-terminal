# FX Terminal UI Rebuild — execution plan (2026-06-10)

**Principle:** USE the design, don't reinterpret it. Source of truth =
`<your-design-assets-dir>`. Transplant the
exact markup + CSS; plug our real money logic + live data underneath; fix copy
last. The previous mess came from parallel agents editing the SAME files —
avoided here by a shared foundation + one owner per non-overlapping page.

## Two transform rules (apply on every page)
1. **De-FX Provider.** Remove "powered by the FX provider / FX Provider Network / settled via the FX provider" from
   all branding/explanatory copy. FX Provider stays ONLY as a venue label: the Swap
   desk list, the Earn vault, the Markets "FX Provider vs DEX" tape. (Copy fixes batched
   at the end.)
2. **Real data, not the mockup's made-up `wc-data.js`.** Predict WC + Specials +
   market/match detail wired to our live 944-market Polymarket feed
   (`lib/wc2026/usePm.ts`, `/api/wc/*`). Specials/player visuals: real headshot
   (`lib/wc2026/playerVisual.ts`) → national flag → WC ball.

## What the design gives vs what we plug in
- Design files give: layout, CSS, markup, the hero, every card, the mobile app
  (already React JSX). Adopt verbatim.
- We plug underneath: wallet connect, signing, real betting (`lib/polymarket`),
  swap execution (`lib/desks/useSwap`), settlement, live data hooks. The design's
  buttons are display-only; we wire them to the working engine.

## Phases
- **Phase 0 — Foundation (owner: lead, done first):** regenerate `app/design.css`
  from design-v2's `fx-terminal.css + wc.css + wc-trade.css` (verbatim, .ds4-scoped);
  sync `:root` tokens in `globals.css`; copy `mobile.css + p2p-mobile.css`; refresh
  all assets (heroes/cards/bg/prod/logos) into `public/brand/`. Build green.
- **Phase 1 — Desktop, one agent per non-overlapping page:** Home(+nav/footer),
  Predict WC hub + groups/matches/bracket/boot, Specials + market/match detail,
  Swap, Markets, Earn, Trade, Portfolio, P2P. Each: copy that page's design-v2
  markup verbatim → wire live data + existing money hooks → de-FX Provider. Owns only
  its page/components; never touches design.css (frozen by Phase 0) or siblings.
- **Phase 2 — Mobile app:** adopt design-v2 React components
  (`app-screens-*.jsx`, `app-ui.jsx`, `ios-frame.jsx`, `app-betslip.jsx`) into
  `components/mobile/`, inject live hooks + real bet/swap. Wire de-FX Provider.
- **Phase 3 — Integration:** copy/de-FX Provider sweep, full gates, push, review.

## Gates (every commit)
`bunx tsc --noEmit && bun run lint && bunx vitest run && bun run build`

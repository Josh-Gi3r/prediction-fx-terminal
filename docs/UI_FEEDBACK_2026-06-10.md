# Josh UI feedback — 2026-06-10 (organized)

## DESKTOP
- **Flags everywhere** instead of text codes (FRA/SPA/ENG) — outright table,
  groups, bracket, matches. We have flagcdn + iso map.
- **Light-font-on-light** still in places (bracket team names, specials team
  names, a section that's fully unreadable). Root sweep needed beyond the hero fix.
- **Golden Boot faces** — desktop boot table has faces ✓; the FEATURED-band
  golden-boot mini uses flags → use faces.
- **"Outright" tab → "Home"**.
- **"Field"** (Mexico vs Field) confusing — clarify it's "Mexico to win the match".
- **Explain the markets** — Josh repeatedly: "I don't know what this means /
  what am I betting on / is there a question?" Outright + YES/NO tables need the
  explicit question + a short explainer.
- **Clickable rows** — outright/market rows should open the market detail page.
- **Specials country markets** (Africa/Asia/Oceania, North America…) → use flag
  or map, not the generic ball.
- **Missing team art** — match cards: only ~24 of 48 teams have card art in
  public/brand/cards/; the rest render plain. Need the other ~24 or a fallback.
- **Portfolio (disconnected)** — show a BLURRED populated demo dashboard behind
  the Connect-wallet prompt, not empty space.

## MOBILE — ROOT CAUSE: it's the OLD hand-built mobile, NOT design-v2.
Needs full Phase-2 transplant of the design-v2 React app (ios-frame.jsx,
app-ui.jsx, app-betslip.jsx, app-screens-a/wc2/b/c/d/p2p.jsx, mobile.css,
p2p-mobile.css) into components/mobile, wired to the SAME live hooks/logic as
desktop. Specific symptoms (all fixed by the rebuild):
- Weird grey header / weird colors (the design "stage" wrapper leaking).
- Light-font-on-light EVERYWHERE (section titles invisible: Products, FX
  corridors, Virtual Liquidity, P2P, Predict FX, Portfolio).
- No "Specials" tab.
- Footballers are flags → should be photos.
- Portfolio-value card empty space on the right.
- "Is anything in mobile linked to main?" → must share live data/logic.

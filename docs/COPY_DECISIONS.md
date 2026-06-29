# Copy decisions — FX Terminal

## Terminology verdicts

### "Deliverable forwards" — KEEP

**Decision:** Keep as-is. "Deliverable forward" is the correct FX industry term distinguishing physically-settled contracts from NDFs (non-deliverable forwards). It signals precision to traders and is used by institutions in SEA corridors. "FX Forwards" is too generic; "Lock-in rate" reads like a consumer banking product. A Robinhood/Kalshi PM would keep the accurate term.

### "Differential perps" → "FX Perps"

**Decision:** Changed everywhere. "Differential perps" is invented jargon with no recognizable meaning outside this codebase. The standard market term is "Perps" or "Perpetuals". "FX Perps" is specific (distinguishes from crypto perps), immediately understood by the target audience, and is what Linear/dYdX/Hyperliquid would use. Code identifiers (`differential`, `DifferentialDrawer`, `inst=differential`) left untouched — only user-visible strings changed.

### "Binary Predictions" — KEEP

Accurate name for the YES/NO Polymarket-style product. No change needed.

---

## FX Provider brand removal

**Rule:** FX Provider named as one venue only in (a) Swap page where 4 desks are compared by name, and (b) Earn page "FX Provider Virtual Liquidity" section (venue label for the VL maker product).

### Removed:
- Trade page hero h1 slop ("Pick a corridor. Pick the instrument. Predict.") → rewritten to concrete copy
- `PositionsView`: "Your settlement vault balances" → "Your vault balances"; "settlement vault — idle balances" → "Vault — idle balances"; "FX Provider Virtual Liquidity — active batches" → "Virtual Liquidity — active batches"; "Tracked locally (The FX provider's order listing...)" → simplified
- Mobile `PortfolioScreen`: "· FX Provider" network label on wallet bar → "· onchain"
- Mobile `EarnScreen`: chip tab "VL ★" → "VL ★"; toast "VL (FX Provider) batch posted" → "VL batch posted"
- Mobile `SwapScreen`: token picker badge "FX Provider FX" → "FX orderbook"; footer note "FX Provider tie-break / FX Provider-only" → venue-neutral language
- Mobile `TradeScreen`: "Differential perps" tile → "FX Perps"; description rewrite

### Kept (sanctioned):
- Swap page lead paragraph: "FX Provider, LiFi, KyberSwap, and CoW" (4-venue comparison)
- Swap desk comparison panel: "FX Provider" row label + "FX orderbook" description
- Swap button label: "Swap via the FX provider" (when FX Provider is best)
- Swap no-route help: "only available on the FX provider" (factual routing explanation)
- Swap footnote: "FX Provider & CoW are orderbook/intent venues" (venue characteristic)
- Markets page lead: "The same regional stablecoin trades at different rates on the FX provider and across DeFi"
- RatesCard header: "Rates across FX Provider & DeFi"; table column "FX Provider"; footer note about FX Provider-only corridors
- Earn page: "FX Provider Virtual Liquidity — active FX maker" section header (Earn venue context)
- CommandPalette hint: "4-desk stablecoin swap — FX Provider, LiFi, Kyber, CoW"
- Error messages: "In-app deposit needs a FX Provider API key" (factual technical error)

---

## Other copy rewrites

### Trade page hero h1
- **Before:** "Pick a corridor. / Pick the instrument. / Predict."
- **After:** "FX corridors. / On-chain settlement. / Real rates."
- **Why:** The before is a triple imperative instruction list — robotic and generic. The after names the actual value props.

### Landing products section
- Eyebrow: "Three products, one collateral vault" → "Three instruments, one vault" (tighter)
- h2: "Pick the surface that fits the trade." → "Choose your instrument." (direct, not slogany)
- "Perp Differential" product card → "FX Perps"
- Summary: rewritten to be concrete about long/short mechanics

### InstrumentTabs
- Tab label: "Differential perps" → "FX Perps"
- Tab description: rewritten to state long/short explicitly

### DifferentialDrawer
- Waitlist banner: minor punctuation fix ("·" → "—")
- Toast: removed "leveraged differentials" jargon

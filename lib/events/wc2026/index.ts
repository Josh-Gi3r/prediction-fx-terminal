/**
 * lib/events/wc2026/index.ts
 *
 * WC2026 example event content module.
 *
 * This module is the reference implementation of the swappable event content
 * feature. It powers the /wc route with:
 *   - Match/group/bracket data (data.ts)
 *   - Polymarket market mappings (pm.ts)
 *   - Player card visuals (playerVisual.ts, teamCard.ts)
 *   - ISO country helpers (wc2026/index.ts)
 *
 * To build a different event (e.g. Olympics, F1, election):
 *   1. Create lib/events/<slug>/ with the same shape.
 *   2. Add pages under app/<slug>/.
 *   3. Add components under components/events/<slug>/.
 *   4. Update nav in components/shared/Nav.tsx if needed.
 *
 * Player photos: public/player-photos/ — replace with your own licensed images.
 * Team card backgrounds: public/brand/cards/ — replace with your own assets.
 * Event-specific background art: public/brand/bg/ — replace as needed.
 *
 * FIFA-specific language ("official result") has been generalized to
 * "official result" throughout this module. No FIFA branding or IP is retained.
 */

// Re-export everything from the original module location for convenience.
export * from "@/lib/wc2026/index";

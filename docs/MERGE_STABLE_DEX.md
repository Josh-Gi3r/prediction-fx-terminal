> ARCHIVED 2026-06-11 — describes a previous architecture. Do not operate from this document.
> Reason: merge history doc with operating instructions that are now superseded; references docs/fx-provider/ which has been moved to docs/archive/.

# fx-provider-module → predfx-terminal merge (2026-06-10)

Everything from the FX provider module (the tested FX Provider engine + 4-desk swap + real Earn)
now lives in this repo. this app is the base: design system,
Privy scaffold, Railway deploy, trade/WC/portfolio surfaces.

## What moved where

|  source | here | notes |
|---|---|---|
| `src/lib/fx-provider/{intent,order,uuidInt,format,types}.ts` | `lib/fx-provider/core/` | tested EIP-712 builders + exact integer math (19 tests) |
| `src/lib/fx-provider/client.ts` | `lib/fx-provider/server-client.ts` | server-only REST client, AbortController timeouts |
| `src/lib/adapters/*` | `lib/desks/` | FX Provider/LiFi/Kyber/CoW adapters + VL batch assembly |
| `src/lib/{useSwap,vlStore,stablecoins,currency,aave,aaveHooks,hooks,faucet}.ts` | `lib/desks/` | swap state machine (approve+permit per desk), Aave v3, yields |
| `src/app/api/*` (17 routes) | `app/api/` | quotes/swap/vl/scan/yields/pendle/perp-vaults — FX_PROVIDER_API stays server-side |
| `SwapCard,RatesCard,EarnCard,PositionsView,TokenPicker,Ticker,…` | `components/desks/` | functional port, light reskin pending |

## Surfaces

- `/swap` — 4-desk comparison (FX Provider/LiFi/Kyber/CoW), ranked on guaranteed
  min-received. Old `/router` redirects here.
- `/markets` — live corridor scan, FX Provider book vs Kyber side by side; row click
  prefills `/swap`.
- `/earn` — REAL: Aave v3 supply (in-app), Pendle PT, HLP/GMX (click-through),
  DeFiLlama SDYS explorer, VL (FX Provider) provide-liquidity. Replaces the fabricated
  stub.
- `/portfolio` — adds DeFi & liquidity positions (vault balances, VL batches
  with cancel, Aave supplies).

## Money-path fixes baked into the merge

1. `buildOrderAmounts()` in `lib/fx-provider/orders.ts` is now the ONE place maker
   order amounts are computed — exact integer math (`exactToAmountRaw`/`toRaw`),
   never `Number * 10 ** decimals`. The two old call sites computed the same
   bid two contradictory ways; both now use the canonical builder (+ unit tests).
2. Orders sign at LIVE `/fx/rate` only. The static registry `refRate` is
   display-fallback; the confirm button disables when the live feed is down.
3. Chain assertion: signing refuses when The FX provider's EIP-712 domain chainId doesn't
   match the app's active chain. Default chain flipped to MAINNET.
4. executor_id from `/health` is bound-checked (4-bit field) before being
   packed into the signed uuid.
5. Expiration clamped to (now+60s, now+365d−300s).
6. The old client-side `executeSwap` (signed server `route_params` blind) is
   DELETED — taker swaps go through `lib/desks/useSwap.ts` + server routes.
7. Headers: HSTS, Permissions-Policy, CSP (REPORT-ONLY — watch staging console,
   then enforce). Railway build pinned to `bun install --frozen-lockfile`.

## Auth

Privy stays primary. When `NEXT_PUBLIC_PRIVY_APP_ID` is unset the app now
mounts a plain `injected()` wagmi provider instead of skipping wagmi — the
full app (swap, VL, Aave) works with MetaMask/Rabby before Privy is linked.

## Still open (priority order)

1. Settlement confirmation: BOTH codebases fire-and-forget after submit. FX Provider
   mainnet fills hang/revert 50–80% first attempt and statuses lie — confirm by
   balance delta, poll `settlement_summary` to terminal. Biggest remaining gap.
2. FX Provider API key+secret in localStorage (`lib/fx-provider/useApiKey.ts`) — move
   in-memory / clear on logout before real users.
3. 409 (silent re-quote) vs 410 (re-quote) handling on `/swap`.
4. `DifferentialDrawer.tsx` rewrite (dead comments, 14-prop indirection).
5. Reskin `components/desks/*` to the Geist/Radix design language.
6. EntryPanel "postOnly" checkbox is still cosmetic; portfolio "Total balance"
   still sums raw numbers across currencies.
7. WC markets: display-only; needs market/settlement design before trading.
8. Two ERROR_COPY/fmtRate duplicates remain (DeliverableDrawer vs EntryPanel).

## Reference docs

`docs/archive/` carries the archived `FX_PROVIDER_API.md`, `FX_PROVIDER_CONTRACTS.md`,
and `HOW_IT_WORKS.md` from the  source build. The full mainnet ground-truth
brief lives at `<design-audit-doc>` §4.

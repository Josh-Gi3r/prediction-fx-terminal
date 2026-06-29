<div align="center">

# Prediction & FX Terminal

### One wallet. Best-rate stablecoin FX, DeFi yield, fiat ramps, and prediction markets — on web and Telegram.

<a href="#"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
<a href="#"><img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js"></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-6e7681?style=flat-square" alt="MIT License"></a>

</div>

<div align="center"><img src="./docs/hero.png" alt="Prediction & FX Terminal screenshot" width="90%" /></div>

---

A **self-custodial trading terminal** where a single wallet signature gets you best-rate stablecoin FX and DEX swaps — fanned out to four competing desks and ranked server-side by guaranteed minimum-received net of live gas — plus real on-chain DeFi yield deposits, a two-sided P2P fiat ramp, and Polymarket prediction-market betting. The server never holds your keys or funds and never executes: it quotes, ranks, and builds payloads; your wallet signs and settles on-chain. Runs on web, mobile, and inside Telegram.

Built for crypto-native treasuries routing stablecoin FX, yield desks parking idle stables, FX market makers posting two-sided liquidity, and prediction-market operators who want a white-label book they actually control.

> **Self-custodial by design.** The server never holds your keys or funds and never executes — every trade is signed by your wallet. The whole stack runs read-only before any paid credentials: quotes, yields, prediction-market reads, and the live FX ticker all work on public RPCs with zero keys. Your brand, your data, your infrastructure.

## ✨ What you can build

- **A best-rate stablecoin FX desk** — settle USDC into any regional stablecoin and always take the best guaranteed minimum-received across four competing desks. The routing brain stays on your server, so the actual ranking logic never ships to a competitor's browser.
- **A white-label self-custodial DeFi front-end** — fork it, set your brand, point env at your own settlement backend, and ship a swap + earn + predict terminal. Drop the Privy app ID and it falls back to injected MetaMask/Rabby with the entire swap/VL/Aave stack intact.
- **A stablecoin yield cockpit** — park idle USDC/USDT/DAI by comparing and supplying directly into Aave v3, Pendle PT, GMX GM pools, or Hyperliquid HLP, with the full DeFiLlama stable-yield landscape scored 0–100 on one screen and a conservative/balanced/aggressive auto-allocator on top.
- **A virtual-liquidity maker tool** — post 2–50 one-sided EIP-712 limit-order legs across many FX corridors from a single budget token, mirror them to Postgres, and cancel the whole batch with one signature.
- **A two-sided peer-to-peer fiat ramp** — let users buy USDC by bank transfer *and* become makers themselves: multi-platform deposits, per-currency rates, private-orderbook whitelists, and vault delegation to rate managers, all escrow-protected on Base.
- **An event prediction book** — run a betting UI for the World Cup (or drop in an Olympics/F1/election module), auto-gate thin markets by liquidity, and route bets over Polymarket's CLOB with creds that never touch your server.
- **A mobile + Telegram prediction wallet** — bridge funds to Polygon and bet on matches, groups, the knockout bracket, and the Golden Boot from a dedicated native-style mobile shell with Telegram haptics.

## 🚀 Features

### Swap aggregation & execution

- **Four-desk swap aggregator with a server-side ranking brain.** `POST /api/quotes` fans out in parallel to the FX settlement provider (orderbook), LiFi, KyberSwap, and CoW. It ranks by `netOutRaw` = committed-minimum-output minus gas converted into output-token units. The ranking math, a 10bps near-tie bias toward the FX provider, and best-desk selection all stay server-side — a genuine **anti-copy boundary**. The client only ever receives the chosen `source` string plus every passing desk's full executable quote. CoW is excluded from execution candidates (an intent may not fill) and only wins if it is the sole quote.
- **Execute on any desk, not just the winner.** The response carries every OK desk's full `NormalizedQuote`, so the client can deliberately pick a non-recommended venue; selection just *defaults* to the server's best.
- **Live-calibrated gas model with a quote-stability cache.** Aggregator gas = live `eth_gasPrice` (publicnode RPC) × 450k units × 1.3 priority multiplier × live ETH/USD (Coinbase spot), cached 60s with a $0.50 fallback. The FX provider and CoW are modeled gasless (the executor/solver pays; a flat $1 fee is already inside the quote). Failed desks retry once, then fall back to a sub-30s "last-good" cache — but FX-provider quotes are explicitly **excluded** from last-good because their UUID is single-use and time-boxed.
- **Real on-chain execution with a verified-outcome state machine.** `useSwap` runs `idle → signing → signing_permit? → approving? → submitting → confirming → success | unconfirmed | error`. `success` fires **only** after an on-chain receipt plus ERC-20 balance-delta verification (or an FX-provider order-status of settled). A 90s timeout yields an honest `unconfirmed` — never a fake success — and the machine **never auto-retries from `confirming`**, because late settlement would mean double-execution. FX signs an EIP-712 intent (+ optional permit); LiFi/Kyber send tx + approve; CoW signs a GPv2 order and polls `/api/cow-status`. FX-provider swaps are **gasless for the user** — the executor submits and pays, the flat $1 fee is baked into the quote, and the UI explicitly steers ETH-less wallets here since they need zero ETH to trade.
- **Pre-sign safety assertions and router allowlists.** The FX executor refuses to sign unless the intent recipient **and** taker equal the connected wallet, and (for permits) the owner is the wallet, the spender is the settlement contract, `value <= maxInputAmount`, and `verifyingContract` is the input token. LiFi approvals are pinned to a 2-address Diamond/Receiver allowlist; Kyber approvals to the KyberSwap MetaAgg v2 router. Approvals are exact-amount, never unlimited — a tampered or MITM'd quote literally cannot redirect or phish an approval.
- **Full rate-scan matrix.** `POST /api/scan` quotes one FROM token against up to 80 targets at once: the FX provider batched 50/call via `/swap/quote/batch`, plus KyberSwap fanned out at concurrency 6 (keyless `X-Client-Id`). Kyber output gets a −50bps haircut so it compares like-for-like against the FX provider's min-out. Returns per-row `fx` vs `kyber` rate plus `bestSource`. **LiFi is deliberately kept out of the bulk scan** (it rate-limits hard) and appears only in the single-pair quote path.
- **Virtual Liquidity (VL) maker desk.** Assemble 2–50 one-sided EIP-712 limit-order legs across many FX corridors sharing **one** budget token (siblings share owner + fromToken + group_id with sequential leg_ids). `toAmount` is computed with pure integer/bigint math — JS float multiply causes EIP-712 signature mismatches on high-magnitude pairs like ITRY (floor rounding was verified against the provider's `/verify-signature`). Each leg is signed individually, submitted as a batch to `/api/vl/batch`, mirrored to Postgres (`/api/account/vl`), and cancellable with a single `CancelVLBatch` EIP-712 signature (`/api/vl/cancel`).

### Earn — real on-chain yield

- **In-app yield deposits, each with its own honest state machine.** Aave v3 mainnet supply/withdraw (pinned Pool + per-stablecoin underlying & aToken addresses, rebasing balance); Pendle fixed-yield PT buy (keyless v2 SDK proxy via `/api/pendle-quote`, exact approve, PT always 18-dec); GMX v2 GM-pool deposit on Arbitrum (ExchangeRouter multicall: `sendWnt` execution fee + `sendTokens` + `createDeposit`, ~0.0003 ETH keeper fee, poll GM balance delta); and Hyperliquid HLP deposit (USDC bridge to HL on Arbitrum → `vaultTransfer` to the HLP vault, poll vault equity). Every one returns `unconfirmed` on timeout rather than faking success.
- **DeFiLlama stablecoin-yield explorer with proprietary scoring.** `/api/yields` pulls the full DeFiLlama pool set, filters to Ethereum + stablecoin + TVL ≥ $1M + sane APY, and returns the top 80. Each pool gets a project tier (A/B/C audited-quality bucket), a yield-type taxonomy (NAV/Lending/Native/LP/Gov), excess-bps over a 3.69% T-bill benchmark, and a 0–100 **SDYS** risk-adjusted score (excess APY + TVL + tier − IL penalty − reward-token-share penalty).
- **Perp-LP vault feed + auto allocator.** `/api/perp-vaults` returns live Hyperliquid HLP APR (`vaultDetails`) plus the top GMX v2 GM pools filtered to USDC-short-paired (where stable LPs actually earn). `AutoYieldPanel` composes a conservative/balanced/aggressive allocation across the live best Aave + Pendle + GMX rates for a user budget. *(GMX and Hyperliquid are LIVE here as Earn-tab LP deposits — not a perps trading screen.)*

### Prediction markets

- **Polymarket betting, signed entirely client-side.** `useBet`: `/api/pm/order` validates the market and returns tokenId/tickSize/negRisk/minOrderSize → USDC.e allowance gate → switch to Polygon → `ClobClient.createOrder` (SDK signs with the user's wallet) → `client.postOrder` FOK submitted **directly to the CLOB** (creds never hit the server) → status mapping `matched/live/delayed` → poll `getOrder` 2s × 20 → `unconfirmed`. Builder attribution runs through `/api/pm/builder-sign` (HMAC secret server-only) via a browser-safe, duck-typed proxy that avoids bundling `node:crypto`.
- **Keyless reads + in-memory cred derivation.** Live market reads, order book (`/api/wc/book` — the YES book describes the binary market), recent trades + holder count (`/api/wc/trades`), and positions (`/api/pm/positions`, registry-enriched, dust-filtered) all work without keys. L2 CLOB creds are derived from a wallet signature and held in React memory only — no localStorage, re-derived on reload, reset on wallet change. USDC.e approval is exact-amount and calls `clob.updateBalanceAllowance` after the on-chain approve.
- **FIFA World Cup 2026 event module with a live PM registry.** A full betting UI over matches, groups, the knockout bracket, props/specials, and the Golden Boot. `scripts/build-pm-registry.mjs` pulls live market IDs from Polymarket's Gamma API into `pmRegistry.json` (lazy fs-read, kept out of the bundle, regenerable at deploy). A liquidity gate (minLiquidity $5k OR volume $10k, spread ≤ 0.08, `acceptingOrders`) is enforced **twice** — at build time *and* again at read time against live Gamma — so a market that thins out auto-drops and the frontend is structurally prevented from ever showing a thin book. `/api/wc/markets` is paginated with category/team/group filters and a snapshot fallback when Gamma is unreachable.
- **Swappable event-content module.** The whole WC2026 module (`lib/events/wc2026` re-exporting `lib/wc2026`; `components/events/wc2026` mirroring `components/wc`) is the reference implementation of a pluggable event surface — drop in `lib/events/<slug>/`, `app/<slug>/`, `components/events/<slug>/` for an Olympics/F1/election book. Gated by `NEXT_PUBLIC_FEATURE_EVENT_MODULE`; FIFA branding is deliberately generalized out.

### Fiat on/off-ramp (zkP2P)

- **On-ramp — buy USDC with a bank transfer.** `useOnramp`: `quoting → signaling → awaiting_payment → capturing → fulfilling → success`. Your code calls `signalIntent` + `fulfillIntent` on the real `@zkp2p/sdk` 0.5.0 `Zkp2pClient` on Base (8453); the browser extension only captures the Buyer-TEE payment proof (multi-row params merged into one Record, attestation at `attestation.zkp2p.xyz`). Optional referrer fee, on-chain cancel-intent supported, and **no fake success** — it only resolves after a `fulfillIntent` receipt.
- **Off-ramp — sell USDC and become a maker.** `useCreateDeposit`: exact-amount USDC approve → `createDeposit` with **multi-platform** payee IDs, per-currency 1e18 conversion rates, an intentAmountRange capped at the deposit, and `retainOnEmpty` → optional Private-Orderbook whitelist hook (`setDepositWhitelistHook`, validates a real contract addr) → optional vault delegation to a rate manager (`setRateManager`). The new `depositId` is resolved race-safely by parsing the `DepositReceived` event from the tx receipt (falling back to `getAccountDeposits` max-id). Min deposit 10 USDC.
- **Live P2P vault directory.** `/api/p2p/vaults` queries the zkP2P public GraphQL indexer for RateManager + ManagerAggregateStats (fee, delegated balance, filled volume, PnL in cents, fulfilled intents, deposits), normalizes units, dedupes re-registrations, white-labels names by stripping the rail's brand prefix, sorts by volume, and feeds the Sell panel's vault-delegation picker.

### Accounts, wallet & infrastructure

- **SIWE wallet auth with EIP-1271.** `GET /api/account/nonce` (single-use, 5-min, in-memory, swept) → wallet signs the SIWE message → `POST /api/account/login`. `verifyLogin` checks domain, nonce freshness, and message expiry, then verifies the signature via off-chain `ecrecover` first and EIP-1271 on-chain fallback (validating Privy smart-wallet / Safe sigs). It mints a `jose` HS256 JWT (24h, iss/aud from `APP_NAME`) set as a `__Host-sid` cookie (HttpOnly/Secure/SameSite=Lax) **and** returned in the body as a Bearer fallback for the Telegram WebView (where cookies get dropped). Invariant: the address always comes from the verified signature, never the request body. *(Not email magic-link.)*
- **Cross-device account persistence (Postgres).** `account_state` (per-wallet prefs JSONB, 16KB CHECK) + `vl_batch` tables. `/api/account/state` hydrates prefs + open VL batches; `/api/account/prefs` does a strict-zod (unknown keys rejected) server-side JSONB deep-merge with a special-cased notifications sub-merge, rate-limited per-IP **and** per-address. Prefs cover slippageBps (10/50/100/custom), settlement stablecoin, default chain, odds format (cents/percent/american), and notifications (betFilled/orderFilled/marketResolves/p2p).
- **Client-side activity log (privacy by design).** An append-only, per-wallet localStorage log capped at 200 entries (swap/bridge/send/bet/p2p_buy/p2p_sell/earn_deposit/earn_withdraw), holding **public metadata only** (tx hash/type/amount/token/chain/timestamp). It is intentionally **not** synced to Postgres — a deliberate privacy decision noted in the migration. Surfaces on `/account → Activity`.
- **Cross-chain bridge funding.** `/api/bridge-quote` routes Ethereum USDC/USDT → Polygon USDC.e via LiFi (source-token allowlisted) with an optional `gasOnDestination` drop, used by `FundWalletModal` to fund a Polymarket betting wallet.
- **Privy gasless (user-pays-gas) transfers.** `/api/wallet/transfer` proxies the Privy Wallet API: the server adds Basic app-id:app-secret auth, forwards the **client-generated** `privy-authorization-signature` (cryptographic consent) and a per-submit idempotency key (dedupes double-clicks), and extracts the tx hash from the `evm_transaction` or `evm_user_operation` (ERC-4337 paymaster) step. The user's own USDC/USDT covers gas when the Privy dashboard toggle is on; 503 when creds are absent. Gated by `NEXT_PUBLIC_FEATURE_GASLESS_SEND`.
- **Telegram Mini App integration.** `/api/telegram/auth` validates raw `initData` via timing-safe HMAC-SHA256 with 24h staleness and returns the verified user. `useLoginWithTelegram` bridges into Privy; `useTelegram` is a safe no-op outside Telegram (ready/expand/haptics). The bot token is server-only and the route 500s if unset (no silent-accept). The mobile surface fires Telegram haptics on tab switch.
- **Flexible wallet connectivity.** With `NEXT_PUBLIC_PRIVY_APP_ID` set → `PrivyProvider` + `@privy-io/wagmi` across Sepolia/Mainnet/Base/Polygon/Arbitrum. Unset/placeholder → standalone wagmi with plain `injected()` (MetaMask/Rabby), and the whole app (swap/VL/Aave) still works pre-Privy. Per-chain rationale is wired in: Base = zkP2P escrow, Polygon = Polymarket CTF, Arbitrum = GMX/Hyperliquid.
- **Dedicated mobile app surface.** `app/mobile` renders a full native-style shell (`MobileApp`) with a bottom tab bar (Home · WC · + · Swap · Earn) and screens for Home, World Cup, Markets, Trade, Swap, Earn, Portfolio, and P2P, plus Market/Match detail and a BetSlip — its own component tree (`components/mobile/**`), not a responsive reflow. `MobileGate` routes mobile users.
- **Live FX ticker tape.** `LiveTickerTape` polls `GET /fx/rate` per corridor every 3s via the FX-provider client (React Query `useQueries`), falling back per-row to the registry `refRate`/`refChg` snapshot on error so the marquee never breaks. The corridor registry covers majors/latam/asia/emea/exotic regions with funding rates, vol tiers, max leverage, and basis. *(These ticker rates are live, even though the perp trade surface below is a demo.)*
- **Token universe = curated LiFi stables ∪ FX-provider tokens.** `/api/tokens` merges LiFi mainnet stablecoins (allowlist-filtered, dedup preferring `verified`) with the FX provider's regional FX stables, marking dual-source tokens and annotating fiat currency. `/api/fx-markets` lists FX-provider markets for the VL flow.
- **Testnet faucet + email waitlist.** `FaucetButton` calls `IssueTestTokenV3.claimTo` to mint all 117 mock tokens (1B each) in one tx. `/api/waitlist` captures email + product (zod-lite email validation), logs to stdout for Railway capture plus an optional append-only file store (`WAITLIST_LOG_PATH`).
- **Per-route rate limiting, Zod validation & a capabilities probe.** Every `/api` route uses an in-memory token-bucket `rateLimit` (e.g. quotes 60/min, scan 6/min, swap 20/min, login/nonce 20/min, wallet-transfer 10/min). `parseJsonBody`/`parseQuery` enforce zod schemas with byte caps. `/api/capabilities` reports `{fxSettlement, fxDeposit}` = whether the FX key + secret are present, so the UI knows which keyed features are live.
- **Nonce-based CSP middleware.** Edge middleware generates a per-request nonce, builds a strict CSP (script-src nonce + strict-dynamic with host fallback, framed allowlist for Privy/WalletConnect/Telegram, `object-src none`, `connect-src` enumerating every upstream), and forwards the nonce to RSC via an `x-nonce` header. Ships in report-only mode with a documented one-flag (`ENFORCE`) cutover.
- **Pluggable provider adapters.** Three typed interfaces document the swap-in contract: `SettlementAdapter` (FX provider default, behind a configurable EIP-712 domain + REST base + `/config`-driven addresses), `PredictionMarketAdapter` (Polymarket default; swap in Manifold/Augur/Azuro), and `FiatRampAdapter` (zkP2P default; swap in MoonPay/Ramp/Transak). `config/contracts.ts` centralizes per-chain addresses with an `/api/config` live-override.

> **A note on convenience routes:** `/markets` and `/router` are not separate features — both simply redirect to `/swap` (FX markets were merged in; the router view was superseded by the 4-desk aggregator).

## 📸 Screenshots

<div align="center"><img src="./docs/hero.png" alt="Prediction & FX Terminal screenshot" width="90%" /></div>

## 🛠 Tech stack

- **Framework:** Next.js 15 (App Router, Turbopack), React 19, TypeScript
- **Chain:** viem + wagmi, with Privy (optional) or an injected EOA connector
- **Venue SDKs:** LiFi, KyberSwap, CoW, Aave v3, Pendle, `@gmx-io/sdk`, `@nktkas/hyperliquid`, `@polymarket/clob-client`, `@zkp2p/sdk`
- **Auth:** SIWE + EIP-1271, `jose` HS256 JWTs in `__Host-` cookies
- **Data:** Postgres (`postgres-js`), DeFiLlama, Polymarket Gamma/CLOB/Data APIs, zkP2P indexer
- **UI:** Tailwind v4, Radix, Motion, visx + lightweight-charts, Zustand + TanStack Query
- **Tooling & deploy:** Biome, Vitest, Playwright, Bun; Railway/nixpacks (Node 22)

## ⚡ Quickstart

Requires **Node 22** (see `.nvmrc`). Bun is used for the lockfile and e2e runner; npm/pnpm also work.

```bash
git clone <your-repo-url> prediction-fx-terminal
cd prediction-fx-terminal

bun install            # or: npm install

cp .env.example .env
# Minimum to boot: set SESSION_JWT_SECRET (openssl rand -hex 32).
# Read-only swap quotes work with the public RPC + venue defaults.

bun run dev            # http://localhost:3000
```

Enable account / VL / activity persistence by setting `DATABASE_URL`, then run migrations:

```bash
node scripts/migrate.mjs
```

The World Cup event module ships a static snapshot; regenerate it and build the live PM registry before first run if you want fresh data:

```bash
bun run data:event-module            # parse-wc2026.py → event snapshot
node scripts/build-pm-registry.mjs   # pulls live market IDs from Gamma API
```

## 🔌 Configuration

Everything is env-driven. Key knobs (full list in `.env.example`):

| Variable | Purpose | Default / required |
| --- | --- | --- |
| `SESSION_JWT_SECRET` | HMAC secret for session JWTs | **Required** — server throws at login if unset |
| `DATABASE_URL` | Postgres for account / VL / activity | Required for those features; routes 500 without it |
| `NEXT_PUBLIC_FX_PROVIDER_API_BASE` / `FX_PROVIDER_API` | FX settlement provider REST base | Placeholder `api.your-fx-provider.example.com` |
| `FX_PROVIDER_API_KEY` / `FX_PROVIDER_API_SECRET` | In-app deposit builder + order-status auth | Optional; deposit/order-status routes 401 without |
| `NEXT_PUBLIC_FX_PROVIDER_CHAIN_ID` | Chain (1 = mainnet, 11155111 = Sepolia) | `1` |
| `NEXT_PUBLIC_RPC` / `_POLYGON_RPC` / `_BASE_RPC` / `_ARBITRUM_RPC` / `ETH_RPC_URL` | RPC nodes | Public (rate-limited) defaults — replace for prod |
| `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Privy auth + gasless send | Empty → injected EOA connector |
| `NEXT_PUBLIC_LIFI_INTEGRATOR` / `LIFI_API_KEY` | LiFi attribution + rate limits | Set integrator; key optional |
| `POLYMARKET_API_KEY` / `_SECRET` / `_PASSPHRASE` | PM order signing (`/api/pm/builder-sign`) | Required for order placement |
| `NEXT_PUBLIC_FEATURE_PM_BETTING` | Enable PM order placement | `false` (reads work without) |
| `NEXT_PUBLIC_FEATURE_PEER` | Enable zkP2P fiat ramp (`/cash`) | `false` (targets prod zkP2P on Base) |
| `NEXT_PUBLIC_FEATURE_GASLESS_SEND` | Privy user-pays-gas sends | `false`; needs `PRIVY_APP_SECRET` |
| `NEXT_PUBLIC_FEATURE_EVENT_MODULE` | Show the WC2026 event module | `true` |
| `TELEGRAM_BOT_TOKEN` | Telegram Mini App initData verification | Optional; falls back to email login |
| `APP_NAME` / `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_STORAGE_NS` | Branding, signing origin, cache namespace | Set per deployment |

The prediction-market provider is a **swappable interface** (Polymarket CLOB adapter), and the FX settlement desk is abstracted behind a configurable EIP-712 domain + REST base — point either at your own backend.

## 🎨 Make it yours

1. **Brand it.** Set `APP_NAME`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_STORAGE_NS`.
2. **Wire your settlement desk.** Point `FX_PROVIDER_API` / `NEXT_PUBLIC_FX_PROVIDER_API_BASE` at a real EIP-712 settlement provider and match `NEXT_PUBLIC_EIP712_DOMAIN_NAME` to its `GET /config`.
3. **Bring production RPCs.** Replace the public defaults with paid nodes.
4. **Choose your auth.** Drop in a Privy app ID, or ship with the injected-wallet connector.
5. **Swap the event module.** The WC2026 module under `app/wc/` and `components/events/wc2026/` is an example — replace it, or set `NEXT_PUBLIC_FEATURE_EVENT_MODULE=false`.
6. **Flip on the gated surfaces** (`PM_BETTING`, `PEER`, `GASLESS_SEND`) once you've added credentials and verified settlement on your target chains.

## 🧪 Status — what's real vs stubbed

Credibility over hype — read this before you ship:

- **Genuinely self-custodial.** The server never holds keys or funds and never executes; every trade requires the user's wallet to sign. The flip side: there is **no server-side custody or escrow** of user assets, by design.
- **FX settlement desk is a placeholder.** It defaults to `api.your-fx-provider.example.com` — point it at a real EIP-712 settlement provider. Without `FX_PROVIDER_API_KEY`/`SECRET`, in-app deposit and order-status return 401/`needsKey` and the deposit UI falls back to an external fund link, though read-only quotes still work.
- **Prediction-market betting is OFF by default** (`NEXT_PUBLIC_FEATURE_PM_BETTING=false`) and needs Polymarket builder creds; `/api/pm/order` and `/api/pm/builder-sign` return 403 when off. Market and position **reads work without it**.
- **Fiat P2P ramp (`/cash`) is OFF by default** (`NEXT_PUBLIC_FEATURE_PEER=false`), requires the zkP2P browser extension, and when enabled targets **production** Base mainnet (no testnet path).
- **World Cup 2026 match/group/odds data is a static snapshot** auto-generated from an Excel master via `scripts/parse-wc2026.py` — **not live**. The live PM registry (`pmRegistry.json`) is built by `build-pm-registry.mjs` and is **not committed**; pages render empty until it is generated.
- **The `/trade` and `/trade/pro` "Predict FX" corridor perp surface is labeled "Coming soon"** and renders a **deterministic mock** order book + recent trades (`genBook`/`genRecentTrades`) over static corridor refRates — it is not a live trading venue. (The corridor FX rates in the ticker, however, *are* live. GMX/Hyperliquid are live too, but as Earn-tab LP deposits, not a perps screen.)
- **Account / VL / prefs persistence requires `DATABASE_URL` + `SESSION_JWT_SECRET`**; those routes 500/401 without them, and the server throws at login if `SESSION_JWT_SECRET` is unset.
- **Gasless send requires a Privy app secret** plus dashboard configuration; it is real ERC-4337/paymaster routing where the user's own USDC/USDT pays gas, not a server-sponsored relay.
- **Slippage is hardcoded at 0.5%** in the quote/build path. User-configured slippage is stored and shown in Settings, but a TODO notes it is not yet threaded through.
- **CSP ships in report-only mode** (`ENFORCE=false`) by default — enforcement is a documented one-line flip.
- **Single-instance state.** Rate-limiting, the SIWE nonce store, and the last-good quote cache are all in-process Maps — correct only on one instance; they won't hold across replicas or restarts (the code comments call this out and suggest Redis).
- **Trust the code, not `ARCHITECTURE.md`.** That doc is partly stale: it lists routes that don't exist (`/api/lifi-quote`, `/api/kyber-quote`, `/api/cow-quote`, `/api/pm/order/submit`, `/api/pm/order/[id]`) and claims "no rate limiting" and an unfixed PM-signing/USDC-approve double-bug — but the shipped code has rate limiting on every route, client-side direct CLOB order signing, and a working `useUsdcApproval` + `updateBalanceAllowance` flow.

## 📄 License

MIT © 2026 — see [LICENSE](./LICENSE).

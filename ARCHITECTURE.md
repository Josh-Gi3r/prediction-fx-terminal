# Architecture

## Overview

FX Terminal is a self-custodial DeFi web app built on Next.js 15 App Router, deployed
on Railway (service: **fx-terminal-web**). The user's wallet never leaves the browser;
the server holds only third-party API credentials.

Runtime: Node 22 + Bun 1.3.12. Build: `bun install --frozen-lockfile && bun run build`.

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — swap entry + WC promo |
| `/swap` | Multi-desk swap (FX Provider / LiFi / Kyber / CoW) |
| `/earn` | Earn overview — vaults and yields |
| `/earn/vaults/[id]` | Individual vault detail |
| `/markets` | Market data |
| `/trade` | Perps trading (GMX / Hyperliquid) |
| `/trade/pro` | Pro perps view |
| `/portfolio` | Connected wallet portfolio |
| `/cash` | zkP2P fiat on/off-ramp — flag-gated (`NEXT_PUBLIC_FEATURE_PEER`) |
| `/router` | Internal swap routing debug |
| `/mobile` | Mobile-specific layout entry |
| `/wc` | World Cup predictions hub |
| `/wc/boot` | WC boot phase |
| `/wc/bracket` | WC bracket |
| `/wc/groups` | WC group stage |
| `/wc/matches` | WC match list |
| `/wc/match/[n]` | Individual match detail |
| `/wc/m/[key]` | Market detail (Polymarket WC market) |
| `/wc/props` | WC prop bets |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms of service |

---

## API Routes

Routes under `app/api/`. Money-mutating routes are marked **[WRITE]**; all
others are read-only proxies or quote fetchers.

### FX Provider (Settlement)
| Route | Type | Description |
|---|---|---|
| `/api/config` | read | FX provider chain config |
| `/api/quote` | read | FX provider swap quote |
| `/api/swap` | **WRITE** | FX provider swap execution (builds unsigned tx, user signs) |
| `/api/order-status` | read | FX order status (requires `FX_PROVIDER_API_KEY`) |
| `/api/fx-markets` | read | FX provider market list |
| `/api/fx-deposit` | **WRITE** | settlement vault deposit builder (requires `FX_PROVIDER_API_KEY`) |
| `/api/vl/batch` | **WRITE** | settlement vault liquidity batch op |
| `/api/vl/cancel` | **WRITE** | settlement vault liquidity cancellation |
| `/api/tokens` | read | FX provider token list |
| `/api/scan` | read | FX provider on-chain scan helper |

### Swap aggregators
| Route | Type | Description |
|---|---|---|
| `/api/lifi-quote` | read | LiFi aggregator quote |
| `/api/kyber-quote` | read | Kyber aggregator quote |
| `/api/kyber-build` | **WRITE** | Kyber encoded tx builder |
| `/api/cow-quote` | read | CoW Protocol quote |
| `/api/cow-order` | **WRITE** | CoW Protocol order submission |
| `/api/cow-status` | read | CoW order status |

### Polymarket
| Route | Type | Description |
|---|---|---|
| `/api/pm/order` | **WRITE** | Polymarket order placement |
| `/api/pm/order/[id]` | read | Polymarket order detail |
| `/api/pm/order/submit` | **WRITE** | Polymarket order submit — relays user CLOB creds (known issue; see P1 debt below) |
| `/api/pm/positions` | read | Polymarket user positions |

### Earn / yield
| Route | Type | Description |
|---|---|---|
| `/api/pendle-markets` | read | Pendle market list |
| `/api/pendle-quote` | read | Pendle yield quote |
| `/api/perp-vaults` | read | Perpetual vaults data |
| `/api/yields` | read | Aggregated yield data |
| `/api/p2p/vaults` | read | P2P vault list |
| `/api/p2p/vaults/[id]` | read | P2P vault detail |

### World Cup
| Route | Type | Description |
|---|---|---|
| `/api/wc/markets` | read | Polymarket WC market registry |
| `/api/wc/book/[key]` | read | Order book for a WC market |
| `/api/wc/trades/[key]` | read | Recent trades for a WC market |

---

## Trust Boundaries

### Client (browser)
- Holds the user's wallet via Privy (or injected EOA — MetaMask/Rabby).
- Signs all transactions. No private keys leave the browser.
- Calls `/api/*` routes for quotes and unsigned tx construction.
- Calls third-party read endpoints directly (FX provider public, Polymarket read).

### Server (Railway)
- Holds `LIFI_API_KEY`, `POLYMARKET_API_KEY/SECRET/PASSPHRASE`,
  `PRIVY_APP_SECRET`, `FX_PROVIDER_API_KEY/SECRET`.
- Never holds user keys.
- **Known issue:** `/api/pm/order/submit` currently relays the user's Polymarket
  CLOB credentials through the server route. This is a P1 item being redesigned
  so the user signs directly client-side. Do not store or log the relayed creds.

---

## Key Library Modules (`lib/`)

| Module | Description |
|---|---|
| `lib/desks/` | Swap desk abstraction (FX Provider, LiFi, Kyber, CoW) |
| `lib/fx-provider/` | FX Provider REST client + vault helpers |
| `lib/polymarket/` | Polymarket CLOB client wrappers |
| `lib/peer/` | zkP2P SDK integration |
| `lib/wc2026/` | World Cup 2026 data + Polymarket market registry |
| `lib/wagmi/` | wagmi config + chain definitions |
| `lib/privy/` | Privy config |
| `lib/corridors/` | FX corridor definitions |
| `lib/orderbook/` | Order book utilities |
| `lib/security/` | CSP and security headers helpers |
| `lib/telegram/` | Telegram Mini App integration |
| `lib/cn.ts` | Tailwind class merge utility |

---

## Known Debt

- **P1 — PM signing double-bug:** EIP-712 domain mismatch (`ClobAuthDomain` vs
  Polymarket CTF Exchange) + `FILL_ADDRESS` substitution missing. No bet can
  succeed until both are fixed. See audit doc.
- **P1 — No USDC approve step:** `useBet.ts` has no allowance/approve call before
  order submission. Separate from the signing bug; both must be fixed.
- **God files:** `EarnCard` (~3,300 lines), WC components. Refactor is deferred.
- **No rate limiting** on any `/api/*` route.
- **No money-path tests:** unit tests exist but none cover swap/order/deposit paths.
- **CVE-2025-29927:** `next@15.1.11` has a known vulnerability. Dependency
  hardening branch is the fix.

Full audit detail: `SECURITY_AUDIT_2026-06-11_INDEPENDENT.md` in the repo root.

# Dependency Risk Acceptance

Post-upgrade residual advisories after Stage 1 + Stage 2 hardening (2026-06-11)
and Privy 2→3 migration (2026-06-12).

## Remaining advisories

| Package | Severity | Advisory | Why accepted | Exit condition |
|---|---|---|---|---|
| `uuid <11.1.1` (transitive via MetaMask SDK, Coinbase wallet-sdk) | Moderate | GHSA-w5hq-g745-h8pq — missing buffer bounds check in v3/v5/v6 when caller-supplied `buf` is passed | App code uses `uuid` v14 directly (safe version). Transitive consumers call uuid v4 internally with no `buf` arg — unexploitable code path. Privy v3 own path (`@privy-io/js-sdk-core › uuid`) cleared. Remaining paths are MetaMask SDK and Coinbase wallet-sdk. Cannot override without breaking own direct `uuid@14` dep. | Cleared when MetaMask SDK and Coinbase wallet-sdk update their internal uuid pin |
| `elliptic <=6.6.1` (transitive via @ethersproject/signing-key in @gmx-io/sdk, @zkp2p/sdk) | Low | GHSA-848j-6mx2-7j84 — cryptographic primitive risky implementation | No fixed release of elliptic exists as of 2026-06-12. In-app signing uses viem/noble-curves not elliptic; elliptic is buried inside ethersproject shims pulled by @gmx-io/sdk and @zkp2p/sdk which do not expose signing paths the app calls. Cannot override — would break the SDKs that vendor it. | Re-review 2026-12-31 when elliptic 7.x or ethersproject replacements ship |
| `js-cookie <=3.0.5` (transitive via `@privy-io/react-auth > @privy-io/js-sdk-core`) | High | GHSA-qjx8-664m-686j — prototype hijack in assign() enables cookie-attribute injection | Privy 3.29.2 still ships js-cookie 3.0.5 (declares `^3.0.5`, resolves 3.0.5 — no 3.0.6+ exists). Injection vector requires attacker-controlled input passed to `js-cookie.set()`; Privy uses this only for its own internal session cookies from trusted Privy server responses. Cannot override without forking Privy internals. | Cleared when js-cookie 3.0.6+ releases and Privy picks it up |
| `postcss <8.5.10` (transitive, nested inside `@tailwindcss/postcss` and `next`) | Moderate | GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` in CSS stringify output | Direct `postcss` dependency is 8.5.15 (patched). Transitive copies inside `@tailwindcss/postcss` and `next` are only used during server-side CSS processing of static/trusted CSS assets — not processing user input. The XSS vector does not apply to this build pipeline. | Resolved when @tailwindcss/postcss and next update their internal postcss pins |

## Cleared advisories

### Cleared by Privy 2→3 migration (2026-06-12)

- `uuid <11.1.1` via `@privy-io/react-auth > @privy-io/js-sdk-core > uuid` — **CLEARED**. Privy v3 js-sdk-core no longer pulls uuid directly.

### Previously cleared (Stage 1 + Stage 2, 2026-06-11)

- `js-cookie` HIGH via Privy 2.x — not cleared; still present in Privy 3.x. Acceptance updated above.
- `@coinbase/wallet-sdk <4.3.0` (high) — cleared by @privy-io/react-auth 2.25.0 pinning 4.3.2 (still held in 3.x)
- `@metamask/sdk >=0.16.0 <=0.33.0` + `@metamask/sdk-communication-layer` (moderate) — cleared by wagmi 2.19.5 pulling @metamask/sdk 0.33.1+
- `ws <8.20.1` (moderate) — cleared by override `ws: ^8.21.0`
- `axios >=1.0.0 <1.15.2` (high cluster, 15+ advisories) — cleared by override `axios: 1.17.0`
- `@stablelib/ed25519 <=2.0.2` (moderate) — cleared by updated @walletconnect stack via wagmi 2.19.5
- `next >=13.0.0 <15.5.16` (critical + 4 high + multiple moderate/low, 22 advisories total) — cleared by Stage 2 bump to 15.5.19

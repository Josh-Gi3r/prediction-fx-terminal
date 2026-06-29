# CSP Nonce Rollout

Tracks the shift from static `'unsafe-inline'` CSP to per-request nonce + `'strict-dynamic'`.

## Current state (report-only phase)

Two headers are active simultaneously:

| Header | Set by | Mode | Purpose |
|---|---|---|---|
| `Content-Security-Policy` | `next.config.ts` headers() | **Enforced** | Legacy policy with `'unsafe-inline'`; protects users now |
| `Content-Security-Policy-Report-Only` | `middleware.ts` | **Report-only** | Nonce policy; violations logged, nothing blocked |

`middleware.ts` sets `ENFORCE = false` at the top of the file. Flip it to `true` to go live.

---

## Regression checklist

Run this checklist in a staging environment **with DevTools console open** watching for CSP violations before flipping ENFORCE.

### Privy login modal
- [ ] Click "Connect Wallet" / login button — Privy iframe opens
- [ ] Sign-in with email OTP completes
- [ ] Sign-in with wallet (MetaMask / injected) completes
- [ ] No console CSP violations mentioning `auth.privy.io`

### WalletConnect modal
- [ ] WalletConnect QR modal opens (`verify.walletconnect.com` frame)
- [ ] Deep-link to a mobile wallet works (scan QR)
- [ ] No violations mentioning `walletconnect.com` or `walletconnect.org`

### Telegram Mini App embed
- [ ] Open the app inside Telegram (via the bot link)
- [ ] `window.Telegram.WebApp.ready()` fires (no console error)
- [ ] The Telegram SDK script (`telegram.org/js/telegram-web-app.js`) loads — check Network tab, status 200
- [ ] No violations mentioning `telegram.org`

### RPC endpoints
- [ ] `/swap` page: obtain a live FX quote (triggers `api.your-fx-provider.example.com`)
- [ ] Wallet balance fetches succeed (triggers `*.publicnode.com` RPCs)
- [ ] Arbitrum RPC call succeeds (`arbitrum-one-rpc.publicnode.com`)
- [ ] No violations on any `connect-src` host

### zkP2P (Peer cash ramp)
- [ ] `/cash` page loads (if NEXT_PUBLIC_FEATURE_PEER=true)
- [ ] Quote fetch from `api.zkp2p.xyz` returns data
- [ ] No violations mentioning `zkp2p.xyz`

### Hyperliquid
- [ ] `/earn` page loads perp data from `api.hyperliquid.xyz`
- [ ] No violations mentioning `hyperliquid.xyz`

### General pages
- [ ] `/` (home) renders without errors
- [ ] `/swap` renders, quote widget functional
- [ ] `/wc` (WorldCup markets) loads market list
- [ ] `/p2p` page loads
- [ ] Fonts render correctly (Geist, Sora, Manrope, Chakra Petch)

---

## How to read report-only violations

Violations from `Content-Security-Policy-Report-Only` appear in the browser console as:

```
[Report Only] Refused to execute inline script because it violates the following
Content Security Policy directive: "script-src 'self' 'nonce-...' 'strict-dynamic' ..."
```

Key fields to note:
- **blocked-uri** — the script/resource that was blocked
- **violated-directive** — which CSP directive caused the block
- **source-file** + **line-number** — where in your code the violation originates

### Common patterns and fixes

| Violation | Cause | Fix |
|---|---|---|
| `inline script` with no nonce | Next.js runtime chunk or third-party inline | Add nonce to the `<Script>` tag or move script to an external file |
| `eval` / `Function()` | WalletConnect or some wallet SDKs use eval | Add `'unsafe-eval'` to script-src **or** find the bundler-transpiled path |
| External host not in allowlist | New SDK / CDN added after policy was written | Add the host to `connect-src` or `script-src` in both `middleware.ts` and `next.config.ts` |
| `frame-src` violation | Privy or WC opened a new iframe origin | Add the origin to `frame-src` |

---

## Enforce flip procedure

Only proceed after zero violations in the checklist above across at least one full staging session.

1. Open `middleware.ts`, change line:
   ```ts
   const ENFORCE = false;
   ```
   to:
   ```ts
   const ENFORCE = true;
   ```

2. Open `next.config.ts`, delete this line from the `headers()` array:
   ```ts
   { key: "Content-Security-Policy", value: CSP },
   ```
   The `const CSP = [...]` block above can also be removed at this point (or kept as documentation).

3. Deploy. Verify with `curl -sI https://fx-terminal.example.com/ | grep -i content-security`:
   - Should show **one** `Content-Security-Policy` header with a nonce value.
   - Should show **no** `Content-Security-Policy-Report-Only` header.

4. Spot-check the full regression checklist one more time on production.

---

## Header behavior reference

### During report-only phase (ENFORCE=false)

```
HTTP/2 200
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...; object-src 'none'; ...
content-security-policy-report-only: default-src 'self'; script-src 'self' 'nonce-<base64>' 'strict-dynamic' ...; object-src 'none'; ...
```

The enforced header blocks real attacks. The report-only header surfaces future violations safely.

### After enforce flip (ENFORCE=true, CSP removed from next.config.ts)

```
HTTP/2 200
content-security-policy: default-src 'self'; script-src 'self' 'nonce-<base64>' 'strict-dynamic' ...; object-src 'none'; ...
```

Single enforced nonce policy. No report-only. No `'unsafe-inline'` in script-src.

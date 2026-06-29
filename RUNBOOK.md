# Runbook

## Deploy

Merge to `main` → CI passes → Railway auto-deploys service **fx-terminal-web**.
No manual step required. Monitor deploy progress in the Railway dashboard under
the fx-terminal-web service → Deployments.

Build command (mirrors `railway.toml`):
```
bun install --frozen-lockfile && bun run build
```
Start command: `bun run start`

## Rollback

1. Railway dashboard → fx-terminal-web service → Deployments tab.
2. Find the last known-good deployment.
3. Click the three-dot menu → **Redeploy**.

Railway re-runs the same build from that commit. No code change needed.

## Environment Variables

Values live in Railway (service → Variables) and the team password manager.
Never commit real values; only `.env.example` (no secrets) is in the repo.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app identifier — exposed to browser; enables Privy wallet auth. Unset = falls back to injected EOA connector. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin used for `metadataBase` and OG tags. Must match the live domain. |
| `NEXT_PUBLIC_FEATURE_PEER` | Feature flag — `true` enables the `/cash` zkP2P fiat ramp (Base mainnet, real money). Off by default. |
| `NEXT_PUBLIC_FEATURE_PM_BETTING` | Feature flag — `true` enables Polymarket bet submission. Off by default until EIP-712 + approve bugs are resolved. |
| `LIFI_API_KEY` | Server-side LiFi API key for swap quote aggregation via `/api/lifi-quote`. |
| `POLYMARKET_API_KEY` | Server-side Polymarket CLOB API key — order submission and position reads. |
| `POLYMARKET_API_SECRET` | Server-side Polymarket CLOB API secret. |
| `POLYMARKET_API_PASSPHRASE` | Server-side Polymarket CLOB passphrase. |
| `PRIVY_APP_SECRET` | Server-side Privy secret — used to verify Privy JWTs in API routes. |
| `FX_PROVIDER_API_KEY` | Optional server-side FX Provider API key — enables vault deposit builder at `/api/fx-deposit`. Without it the earn surface falls back to a link. |
| `FX_PROVIDER_API_SECRET` | Optional server-side FX Provider API secret (paired with `FX_PROVIDER_API_KEY`). |

## Incident Response

### Kill PM betting immediately

Unset `NEXT_PUBLIC_FEATURE_PM_BETTING` in Railway → Variables (delete or set to
`false`) → trigger a redeploy (Variables change auto-deploys on Railway). The
feature disappears from the UI on next load; no order submission path is
reachable.

### Check FX provider upstream health

```sh
curl https://api.your-fx-provider.example.com/api/v1/config
```

A `200` with a JSON body means the FX provider is up. A non-200 or network timeout means
the app's swap/earn surfaces will degrade. No action needed on our side; the FX provider
outages are self-recovering. Check [FX provider status] if downtime is prolonged.

### Logs

Railway dashboard → fx-terminal-web service → Logs tab. Filter by deployment or
stream live. No external log drain is configured yet.

# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Email: security@fx-terminal.example.com
_(Confirm this address is monitored before the first public release.)_

Include:
- Description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept code or curl commands are helpful)
- Affected URL(s) or code path(s)

Response target: **72 hours** to acknowledge, best-effort triage within 7 days.

## Scope

**In scope:**
- The FX Terminal web app and all pages at fx-terminal.example.com
- API routes under `/api/*` on fx-terminal.example.com

**Out of scope:**
- Third-party execution venues and liquidity sources: FX settlement provider, Polymarket,
  Kyber Network, CoW Protocol, LiFi, zkP2P/Peer, Pendle, GMX, Hyperliquid, Aave
- User wallet security (seed phrases, hardware wallets, browser extensions)
- Issues in upstream dependencies that have no exploitable impact on this app
- Social engineering

## Supported Versions

Only the current production deployment (main branch, live on Railway) is
supported. Issues on older commits or branches will not receive patches.

## Bug Bounty

No bounty program at this time. We will acknowledge researchers who report
valid vulnerabilities responsibly.

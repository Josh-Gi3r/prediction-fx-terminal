# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- CI pipeline: type-check, lint, test, build, audit gate, and secret scan on
  every push to main and every pull request (`.github/workflows/ci.yml`).
- Gitleaks secret scanning with project-scoped allowlist (`.gitleaks.toml`).
- `CODEOWNERS`, `LICENSE`, `.nvmrc`, `SECURITY.md`, `CONTRIBUTING.md`,
  `RUNBOOK.md`, `ARCHITECTURE.md` — repo governance baseline (audit P2-5).

### Changed
- Polymarket (PM) betting feature is now flag-gated behind
  `NEXT_PUBLIC_FEATURE_PM_BETTING`; flag is `false` by default until the
  EIP-712 domain and USDC approve bugs are resolved.
- FX provider capabilities degradation: app falls back gracefully when `FX_PROVIDER_API_KEY`
  is unset — earn vault deposit builder shows a "fund via your-fx-provider.example.com" link
  instead of a dead API call.

### Fixed
- `localStorage` purge on stale schema keys to prevent hydration mismatches
  after the design migration.
- `metadataBase` set to the real production URL (was `fx-terminal.example`).

# Contributing

## Branch flow

- Work on short-lived feature branches cut from `main`.
- Open a pull request targeting `main`.
- CI must pass before merge. No direct pushes to main.

## Local gates before pushing

Run this before opening a PR. CI will run the same checks and will fail if you skip them.

```sh
bun run typecheck && bun run lint && bun run test && bun run build
```

## Commit convention

Follow the scoped prefix pattern already in the log:

| Prefix | Use |
|---|---|
| `fix(scope):` | Bug fix |
| `feat(scope):` | New feature or capability |
| `copy(scope):` | Copywriting — see rule below |
| `perf(scope):` | Performance improvement |
| `security(scope):` | Security hardening |
| `chore(scope):` | Dependency bump, config, tooling |
| `docs(scope):` | Documentation only |

Subject line: lowercase, no trailing period, imperative mood ("add X", not "added X").

## Copy-agent rule

Commits with the `copy(scope):` prefix must be **text-only diffs**.
Specifically, a copy commit:

- May only change string literals (copy, labels, placeholders, aria-label text).
- Must not touch logic, props, imports, or event handlers.
- Must not touch any file under:
  - `app/api/**`
  - `lib/**` (except files that contain only label/string constants)
  - `app/providers.tsx`
  - `next.config.ts`
  - `app/legal/**`

If a copywriting change also requires a logic change, split it into two commits.

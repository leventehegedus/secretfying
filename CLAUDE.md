# Flight Deal Watcher

Personal flight-deal watcher for one user in Budapest (BUD). Collects prices from official APIs once a day,
stores every observation, detects deals, verifies the best ones live within quota, notifies via Telegram/e-mail.
Never books, never handles payments.

## Stack

React 18 + Vite + Tailwind + shadcn/ui, strict TypeScript, TanStack Query, React Router (`apps/web`).
Fastify + Zod + Drizzle/SQLite (better-sqlite3) + node-cron + pino (`apps/api`).
Pure TS + Zod shared schemas and all deal maths (`packages/shared`). pnpm workspaces + Turborepo, Node 22, Vitest.

## Commands

- `pnpm dev` (api :3000, web :5173 with /api proxy) · `pnpm build` · `pnpm typecheck` · `pnpm lint`
- `pnpm test` (Vitest, `--reporter=dot`) · `pnpm dup` (jscpd, 3 % threshold)
- `pnpm db:migrate` · `pnpm db:seed` · `pnpm backfill`
- One package: `pnpm --filter @fdw/api test`

## Rules

- Server state goes through TanStack Query, never `useEffect` fetching.
- No `any`, no `as unknown as T`. Small components with explicit typed props.
- Deal logic lives only in `packages/shared`; api and web import it, never reimplement it.
- Never fabricate, interpolate or hard-code prices outside test fixtures. Missing data is shown as missing.
- Never exceed a provider quota. Every live/paid call goes through `QuotaGuard`. No live API calls in tests or CI.
- Official APIs only, no scraping. No booking, payment or login features.
- No secrets in the repo (only `.env.example`), never log keys. Do not read or edit `.env*` or lockfiles.
- Lean dependencies, pinned majors. jscpd fires: extract shared code, do not raise the threshold.
- Code, comments, commits, docs in English; UI strings in Hungarian (default) and English.
- Use jCodeMunch for code lookups (symbols/outlines) instead of reading whole files.

## Glossary

- **IATA city vs airport**: `BUD` is both; `LON` is a city (LHR, LGW, STN...). Watches may use either.
- **Cached price**: indicative price from discovery data (Travelpayouts cache of other users' searches, 2-7 days old).
- **Live (verified) price**: fetched now from a verification provider (SerpApi, Ignav).
- **candidate**: deal found in cached data. **verified**: live price confirmed within tolerance (default 10 %).
  **stale**: verification failed or the price is gone.
- **Rolling median**: median of a route's observations in the last 90 days. **P10**: 10th percentile of history.
- **insufficient_history**: fewer than N (14) observations or under 7 days span; stats are `null`, never 0,
  and only `BELOW_MAX_PRICE` may fire.
- **market**: Travelpayouts data partition (e.g. `hu`); results differ per market.
- **quota**: per-provider daily/monthly call caps, tracked in `quota_ledger`.

## Definition of done

`pnpm lint && pnpm typecheck && pnpm test && pnpm dup` pass; UI changes verified in a browser (Playwright MCP).

## Workflow

- Plan mode for anything bigger than a small fix; plans live in `docs/plans/`.
- Hooks run eslint --fix + tsc on the edited package; fix what they report.
- Verify UI via Playwright MCP. Run a review pass before committing a phase.
- Conventional commits, one logical step each.

## Model routing (`.claude/agents/`)

- `scout` (haiku): search, log/test summaries, fixtures, renames, i18n entries, docs formatting.
- `builder` (sonnet, default): features, tests, routes, providers, UI, normal debugging.
- `architect` (opus): only deal-engine/quota design, a bug the builder failed twice, final review.
  Justify each use in `docs/DECISIONS.md`.

## Token rules

Plan once, then execute. No re-reading held files. Batch independent calls. Tiny fixtures (≤20 rows).
Terse reporters, read failures only. Same failure 3 times: stop, write findings to `docs/PROGRESS.md`, ask.

## Handoff

After each phase: checks, commit, update `docs/PROGRESS.md` (done / next / open decisions). A fresh session
continues from this file plus `docs/PROGRESS.md`.

# Progress

## Phase 1: setup (done)

Monorepo scaffolded (pnpm 11 + Turborepo, `apps/api` Fastify health route + test, `apps/web` Vite React stub,
`packages/shared` stub), strict TS base config, ESLint flat config, Prettier, jscpd (3 %), GitHub Actions CI,
`.claude/` agents (scout/builder/architect), hooks (env/lockfile guard, per-package eslint + tsc) and deny
rules, `CLAUDE.md`. All checks pass.

## Phase 2: design (done)

Design in `docs/plans/2026-10-30-deal-engine-design.md` (schemas, stats, rules, provider interface, quota
guard, run pipeline; "my call" items need owner review). Task plan for phases 3 and 4 in
`docs/plans/2026-10-30-shared-and-api-plan.md` (13 tasks, TDD, one commit each).

Owner feedback applied as "Revision 1" in both docs: EUR only, max 1 retry, no Ignav/e-mail, all on
Vercel (Services, Turso, Vercel Cron). Vercel project `secretfying` linked + connected to GitHub.

## Phase 3: packages/shared (done)

Schemas, stats (median, nearest-rank percentile, sufficiency with month/route basis, all-time min),
rule evaluation, ranking, verification outcome and alert rules; 43 tests. Built by a Sonnet subagent,
reviewed (ponytail) and fixed: all-time `min` for `NEW_ROUTE_LOW`, watch date-range check,
`ProviderStatus` uses `unavailable`.

## Phase 4: apps/api (done)

Config (Zod, empty = unset), Drizzle schema on Turso/libSQL with explicit dedupe keys, QuotaGuard
(async, mutex + immediate transaction, every attempt reserves), guarded HTTP (max 1 retry),
Travelpayouts `prices_for_dates` discovery with 20 h cache, IATA/places reference, SerpApi
verification, fixture provider for `DRY_RUN`, registry, discovery/detection/verification services,
idempotent `runOnce` (lock, 240 s deadline, failed-provider skip), Telegram digest, REST routes,
`/docs` OpenAPI JSON, bearer auth (fails closed on production without `API_TOKEN`),
`GET /api/cron/run` for Vercel Cron, seed/backfill scripts, `vercel.json` (Services + daily cron).
103 api tests. Deployed: https://secretfying.vercel.app/api/health is 200; Turso migrated in build.
Ponytail review findings fixed (deadline, cache TTL). Untested: verification-phase deadline and
skipping a failed verifier on later deals.

**Next:** Phase 5, `apps/web` (shadcn, i18n, dashboard, watches, watch detail, history, settings;
the SPA must send `API_TOKEN` as a bearer token on writes, entered once and kept in localStorage).
**Owner to do:** set `API_TOKEN`, `TRAVELPAYOUTS_TOKEN`, `SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID` on Vercel (Production). Then one approved live smoke test.

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

**Next:** Phase 4, Tasks 5 to 13 (`apps/api`). Task 5 needs Turso: owner must accept Turso terms at
https://vercel.com/levente-hegedus-projects/~/integrations/accept-terms/tursocloud?source=cli, then run
`vercel --non-interactive integration add tursocloud/database --no-claim`. Add `vercel.json` (Services +
cron) in Phase 4; Vercel builds fail until then.
**Open:** jCodeMunch and `.claude/agents` load only after a session restart.

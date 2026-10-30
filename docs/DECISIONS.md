# Decisions

Short log of choices made while building. Newest last.

## Phase 1: setup

- **TypeScript 6.0, not 7.0.** typescript-eslint 8.x supports `<6.1`; TS 7 (native port) would break linting.
- **React 18.3** as specified, although React 19 is current. Vite 8 + `@vitejs/plugin-react` 6.
- **Node**: `.nvmrc` pins 22 (CI and Docker); `engines` is `>=22` so local Node 24 also works.
- **pnpm 11** with `allowBuilds` in `pnpm-workspace.yaml` for `better-sqlite3` and `esbuild` native builds.
- **`packages/shared` builds to `dist/`** and turbo runs `^build` before typecheck/lint/test, so the api runs
  plain Node in production without a TS loader.
- **jscpd ignores test files** (`*.test.ts(x)`) besides generated shadcn components, migrations and fixtures:
  arrange/act blocks in tests repeat by nature; production code stays under the 3 % gate.
- **Env guard allows `.env.example`**: the PreToolUse hook blocks every other `.env*` file and lockfiles.
- **jCodeMunch** is configured and connected, but its tools were not exposed in the phase 1 session;
  lookups fell back to Grep/Read. Restart the session to pick it up.

## Phase 2: design

- **Opus use #1**: deal engine, provider interface and quota/verification pipeline design
  (`docs/plans/2026-10-30-deal-engine-design.md`), the one planned Opus step.
- Design-level calls (details in the design doc, marked "my call"): no FX conversion, nearest-rank
  percentile, insufficient history blocks `PROVIDER_PRICE_LEVEL_LOW` too, Ignav only if its API docs
  can be confirmed, `fixture` provider for `DRY_RUN` demos, retries consume quota.
- Design builder-check done inline instead of a separate subagent, to save tokens.

## Owner feedback after phase 2

- EUR only; at most 1 retry per call; no Ignav; no e-mail (Telegram only).
- Hosting moved to **Vercel** (owner choice): Vercel Services (web + Fastify API in one project),
  **Turso** via Vercel Marketplace replaces the SQLite file (same Drizzle SQLite dialect, `libsql`
  driver), **Vercel Cron** replaces `node-cron`. Docker/VPS deploy target from the original prompt
  dropped. Vercel project `secretfying` linked and connected to the GitHub repo.

## Phase 4: api

- **Turso provisioned** via Vercel Marketplace (`database-canary-diamond`); env `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN` on all Vercel environments. Client: `@libsql/client` + `drizzle-orm/libsql`
  (mature Drizzle support, same client for `libsql://`, `file:` and `:memory:`), not the newer
  `@tursodatabase/serverless`. The integration also installed the `turso-cloud` agent skill.
- **Travelpayouts uses only `prices_for_dates`** (also covers `ANYWHERE` by omitting `destination`);
  `month-matrix`, `city-directions` and `special_offers` are not used because their response formats
  could not be confirmed from official docs. Known limit: return queries use the same month for
  `return_at`, so trips that return in the next month are not discovered.
- **No third-party Travelpayouts SDK** (owner does not trust `travelpayouts-js`); direct `fetch` only.

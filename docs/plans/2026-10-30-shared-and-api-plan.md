# Shared package and API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `packages/shared` (schemas + all deal maths) and `apps/api` (DB, providers, quota guard, run pipeline, REST, cron, notifier).

**Architecture:** Pure, fully tested functions in `packages/shared`; the API composes them with Drizzle/SQLite persistence, provider adapters behind `FlightPriceProvider`, and a synchronous SQLite-backed `QuotaGuard` that every network attempt must pass.

**Tech Stack:** TypeScript 6 strict, Zod 4, Vitest 5, Fastify 5, Drizzle ORM + better-sqlite3, node-cron, pino, nodemailer.

**Spec:** `docs/plans/2026-10-30-deal-engine-design.md` plus build prompt sections 4 to 8 and 11.

## Global Constraints

- Never fabricate, interpolate or hard-code prices outside test fixtures; missing data stays `null`.
- Never exceed a provider quota, even by one; no live API calls in tests or CI.
- Deal logic only in `packages/shared`; `packages/shared` has no runtime deps beyond Zod.
- No `any`, no `as unknown as T`; `noUncheckedIndexedAccess` on.
- Fixtures at most ~20 rows per file; Vitest `--reporter=dot`.
- Never log API keys; redact secret query params.
- Conventional commits, one per task.

## Review Focus

1. Watch window crossing a year boundary (`monthsAhead` from November): months list must be `2026-11, 2026-12, 2027-01`. Test in Task 9.
2. Provider returns prices in a different currency than requested: rows dropped by validation, not compared. Test in Task 7.
3. Same route+dates discovered by two watches (e.g. `BUD-LIS` and `ANYWHERE`): deals keyed per watch, alert deduped per route+dates across watches. Test in Task 10.
4. Run triggered while the cron run is still going: second call gets `409`, no double calls. Test in Task 11.
5. Telegram API down: run still finishes `done`, notification failure logged in run summary. Test in Task 12.

---

## Phase 3: `packages/shared`

### Task 1: Schemas and settings

**Files:** Create `packages/shared/src/schemas/{common,observation,watch,settings,deal}.ts`, `src/schemas/index.ts`; modify `src/index.ts`. Test: `src/schemas/schemas.test.ts`.

**Produces:** `Iata`, `Destination`, `IsoDate`, `IsoDateTime`, `Currency`, `ProviderId`, `TripType`, `PriceObservation`, `PriceInsights`, `WatchInput`, `Watch`, `Settings`, `DEFAULT_SETTINGS`, `ReasonCode`, `DealStatus`, `ProviderStatus`, `Deal` (Zod schemas, with `type X = z.infer<typeof X>` exports of the same name).

- [ ] Test: `PriceObservation` rejects `amount: 0`, `-1`, `NaN`; `origin === destination`; `returnDate < departDate`; `departDate` before `observedAt` date; `deepLink: "http://..."`; lowercase IATA; `2026-02-30`. Accepts a valid one-way and a valid return row.
- [ ] Test: `Settings.parse({})` equals `DEFAULT_SETTINGS` with the 12 defaults from the design table; `belowMedianPct: 120` rejected.
- [ ] Test: `WatchInput` defaults `origin` to `"BUD"`, accepts `destination: "ANYWHERE"`, rejects `minStay > maxStay`, rejects `maxStay` with `tripType: "oneway"`.
- [ ] Implement; run `pnpm --filter @fdw/shared test`; commit `feat(shared): add domain schemas and settings defaults`.

### Task 2: Statistics

**Files:** Create `src/deals/stats.ts`. Test: `src/deals/stats.test.ts`.

**Produces:** `median(values: readonly number[]): number | null`, `percentile(values: readonly number[], p: number): number | null` (nearest rank: sorted[ceil(p/100*n)-1]), `historyStats(history: readonly HistoryPoint[], opts: { now: Date; departMonth: string; settings: Settings }): HistoryStats` where `HistoryPoint = { amount: number; observedAt: string; departDate: string }` and `HistoryStats = { sufficiency: "ok" | "insufficient_history"; count; spanDays; basis: "month" | "route" | null; median: number | null; p10: number | null; min: number | null }`.

- [ ] Tests: `median([])` → `null`; `[3,1,2]` → `2`; `[1,2,3,4]` → `2.5`. `percentile([10..100 step 10], 10)` → `10`; `percentile([5], 10)` → `5`; result is always a member of the input.
- [ ] Tests: 13 points over 10 days → insufficient (stats `null`, not `0`); 14 points over 6.9 days → insufficient; 14 points over exactly 7 days → ok; points older than 90 days excluded; 14 same-month points over 7 days → `basis: "month"`; only 10 same-month but 20 total → `basis: "route"`.
- [ ] Implement; test; commit `feat(shared): add rolling median, percentile and history sufficiency`.

### Task 3: Rule evaluation

**Files:** Create `src/deals/evaluate.ts`. Test: `src/deals/evaluate.test.ts`.

**Consumes:** `HistoryStats`, `PriceInsights`, `Settings`, `ReasonCode`.
**Produces:** `evaluateFare(input: { amount: number; maxPrice: number | null; stats: HistoryStats; insights?: PriceInsights | null; settings: Settings }): { reasons: ReasonCode[]; discountPct: number | null; belowMaxPct: number | null }`.

- [ ] Tests per rule at the boundary: `amount === maxPrice` fires `BELOW_MAX_PRICE`, `maxPrice + 0.01` does not; median 100, amount 70 fires `BELOW_MEDIAN_PCT`, 70.01 does not; `amount === p10` does not fire `BELOW_P10`, `p10 - 0.01` does; `amount === min` no `NEW_ROUTE_LOW`; insights `low` fires `PROVIDER_PRICE_LEVEL_LOW`.
- [ ] Test: insufficient stats + insights `low` + amount under max → reasons exactly `["BELOW_MAX_PRICE"]`, `discountPct: null`.
- [ ] Test: `discountPct` for median 200, amount 130 → `35`; `belowMaxPct` for max 150, amount 120 → `20`.
- [ ] Implement; test; commit `feat(shared): add deal rule evaluation`.

### Task 4: Ranking, verification outcome, alert rules

**Files:** Create `src/deals/pipeline.ts`, `src/deals/index.ts`. Test: `src/deals/pipeline.test.ts`.

**Produces:**

- `rankScore(d: { discountPct: number | null; belowMaxPct: number | null }): number`
- `pickForVerification<T extends RankableDeal>(deals: readonly T[], k: number, isRecentlyVerified: (d: T) => boolean): T[]` where `RankableDeal = { discountPct; belowMaxPct; amount }`
- `applyVerification(input: { candidateAmount: number; live: { amount: number; insights?: PriceInsights | null } | null; maxPrice: number | null; stats: HistoryStats; settings: Settings }): { status: "verified" | "stale"; amount: number | null; reasons: ReasonCode[]; discountPct: number | null; belowMaxPct: number | null }`
- `isAlertable(status: DealStatus, settings: Settings): boolean`
- `shouldAlert(amount: number, lastAlertAmount: number | null, settings: Settings): boolean`
- `routeKey(origin: string, destination: string, tripType: TripType): string`

- [ ] Tests: ranking puts discount 40 before below-max 25 before null/null; ties → lower amount first; recently verified skipped and K respected.
- [ ] Tests: `live: null` → stale; candidate 100, live 110 (10 %) → verified at 110 if rules still fire, live 110.01 → stale; live 80 → verified at 80; live within tolerance but no rule fires → stale.
- [ ] Tests: `isAlertable("candidate", defaults)` false, true with `alertCandidates`; `shouldAlert(95, 100)` true, `95.01` false, `(x, null)` true.
- [ ] Implement; export everything from `src/index.ts`; run full shared tests + `pnpm dup`; commit `feat(shared): add ranking, verification and alert rules`.

**Phase 3 checkpoint:** `pnpm lint && pnpm typecheck && pnpm test && pnpm dup`, ponytail review, `docs/PROGRESS.md`.

## Phase 4: `apps/api`

### Task 5: Config and DB

**Files:** Create `apps/api/src/config.ts`, `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/` (generated), `src/db/migrate.ts`; scripts `db:generate`, `db:migrate`. Test: `src/config.test.ts`, `src/db/client.test.ts`.

**Produces:** `loadConfig(env: NodeJS.ProcessEnv): Config` (Zod; all env vars from the prompt, quota caps `QUOTA_<PROVIDER>_DAILY|MONTHLY`, `DRY_RUN`, `DATABASE_URL` default `./data/fdw.db`, `CRON_SCHEDULE` default `0 7 * * *`, `TZ_SCHEDULE` default `Europe/Budapest`, `DISCOVERY_PROVIDERS`, `VERIFY_PROVIDERS`, `TRAVELPAYOUTS_MARKET` default `hu`, `API_TOKEN?`, SMTP vars); `createDb(url: string): Db` running migrations (`:memory:` for tests). Tables per design doc.

- [ ] Tests: defaults applied; `QUOTA_SERPAPI_MONTHLY` defaults to `200`; invalid cron rejected; error message lists the bad key names but never values.
- [ ] Test: `createDb(":memory:")` creates all 8 tables; observation unique key rejects a duplicate same-day row.
- [ ] Implement; generate migration; commit `feat(api): add config validation and sqlite schema`.

### Task 6: QuotaGuard and HTTP helper

**Files:** Create `src/quota/guard.ts`, `src/providers/http.ts`. Test: `src/quota/guard.test.ts`, `src/providers/http.test.ts`.

**Produces:** `class QuotaGuard { constructor(db: Db, caps: QuotaCaps, opts: { now: () => Date; tz: string; dryRun: boolean }); reserve(p: ProviderId, kind: "discover" | "verify", runId?: number): { ok: true; id: number } | { ok: false; kind: "quota_exhausted" | "dry_run"; reason: string }; settle(id: number, status: "ok" | "error"): void; remaining(p: ProviderId): QuotaUsage }`; `class QuotaError extends Error { kind }`; `getJson(url: string, opts: { headers?; timeoutMs?; retries?; reserve: () => void; fetchFn?: typeof fetch; redact?: string[] }): Promise<unknown>` (`reserve` throws `QuotaError` to stop).

- [ ] Guard tests from the design doc list (cap boundary, day + month rollover in Budapest, `Promise.all` 10 with cap 3, errors count, dry run, cap 0).
- [ ] HTTP tests with fake `fetchFn`: 500 then 200 → 2 reservations; 429×3 → throws after 3 attempts; 400 → no retry; timeout → error message without the token; reserve throwing stops before fetch.
- [ ] Implement; commit `feat(api): add quota guard and guarded http helper`.

### Task 7: Travelpayouts provider

**Files:** Create `src/providers/types.ts`, `src/providers/travelpayouts.ts`, `src/providers/normalize.ts`, `src/providers/fixtures/travelpayouts-*.json`. Test: `src/providers/travelpayouts.test.ts`.

**Produces:** `FlightPriceProvider`, `DiscoverQuery`, `VerifyQuery`, `ProviderResult`, `ProviderContext` (per design §2); `normalize(rows: unknown[], log): { observations: PriceObservation[]; dropped: number }`; `createTravelpayouts(cfg): FlightPriceProvider` with pure `parsePricesForDates`, `parseMonthMatrix`, `parseCityDirections`, `parseSpecialOffers`.

- [ ] First confirm endpoint params and response shapes from the official Travelpayouts docs (record URLs in `docs/DATA_SOURCES.md`); fixtures follow the documented shape, ≤20 rows, trimmed.
- [ ] Tests: each parser maps fixture rows to observations with `isCached: true`, `source: "travelpayouts"`; a row with `price: 0`, a bad IATA and a wrong currency are dropped and counted; `ANYWHERE` uses city-directions; response cache hit makes zero fetch calls; token sent as `X-Access-Token`, never in the URL.
- [ ] Implement; commit `feat(api): add travelpayouts discovery provider`.

### Task 8: SerpApi provider (+ Ignav if documented) and registry

**Files:** Create `src/providers/serpapi.ts`, `src/providers/fixture.ts`, `src/providers/registry.ts`, fixtures `serpapi-*.json`; `src/providers/ignav.ts` only if docs confirmed. Test: `serpapi.test.ts`, `registry.test.ts`.

**Produces:** `createSerpApi(cfg)`, `parseGoogleFlights(json, q, observedAt): { observation: PriceObservation | null; insights: PriceInsights | null }`; `createFixtureProvider()`; `buildRegistry(cfg): { discovery: FlightPriceProvider[]; verification: FlightPriceProvider[]; statuses: Record<ProviderId, ProviderStatus> }`.

- [ ] Tests: cheapest flight within `maxStops` picked across `best_flights` + `other_flights`; `price_insights.price_level: "low"` → `level: "low"`; no flights → `observation: null`; `api_key` redacted in logged URLs.
- [ ] Tests: missing key → `disabled`; `DRY_RUN` → only fixture provider, network ones `dry_run`; order follows env.
- [ ] Implement; commit `feat(api): add serpapi verification provider and provider registry`.

### Task 9: Discovery and detection services

**Files:** Create `src/services/watches.ts`, `src/services/discovery.ts`, `src/services/detection.ts`. Test: `discovery.test.ts`, `detection.test.ts`.

**Produces:** `watchMonths(w: Watch, now: Date): string[]`; `matchesWatch(o: PriceObservation, w: Watch): boolean`; `discoverForWatch(w, providers, ctx): Promise<{ stored: number; statuses }>` (upsert latest price per day); `detectDeals(db, runStartedAt: Date, settings): DealRow[]` using shared `historyStats` + `evaluateFare`.

- [ ] Tests: year-boundary months (Review Focus 1); stay-length and `maxStops` filters; same-day re-store keeps one row with the newest price; detection uses only observations before `runStartedAt`; insufficient history yields only `BELOW_MAX_PRICE` deals.
- [ ] Implement; commit `feat(api): add discovery and deal detection services`.

### Task 10: Verification service and run job

**Files:** Create `src/services/verification.ts`, `src/jobs/run.ts`, `src/jobs/scheduler.ts`. Test: `verification.test.ts`, `run.test.ts`.

**Produces:** `verifyTopDeals(db, deals, providers, ctx, settings): Promise<VerifySummary>`; `runOnce(deps: RunDeps): Promise<RunSummary>` (lock, discover, detect, verify, notify, finish per design §4); `startScheduler(cfg, deps): ScheduledTask`.

- [ ] Tests: only top K verified; second run same day makes zero provider calls and sends no second "nincs akció" digest; serpapi quota exhausted → falls back to next provider, else deal stays `candidate` with reason; two watches finding the same route+dates → one alert (Review Focus 3); stale running lock older than 30 min marked failed.
- [ ] Implement; commit `feat(api): add verification service and idempotent daily run`.

### Task 11: REST API

**Files:** Create `src/routes/{watches,deals,prices,settings,quota,refresh,notify,health}.ts`, `src/plugins/auth.ts`; modify `src/app.ts` (`buildApp(deps): FastifyInstance`, swagger at `/docs`). Test: `src/routes/*.test.ts` via `inject` on `:memory:` DB.

- [ ] Tests: watches CRUD with Zod 400s (unknown IATA rejected via reference-data check, see Task 7 city-directions/airport list); `GET /api/deals?status=verified`; `GET /api/watches/:id/prices?range=90d` returns series + rolling stats with `null` medians when insufficient; `PUT /api/settings` validates; `GET /api/quota`; `POST /api/refresh` while running → 409 (Review Focus 4), rate limited to 1/min → 429; `API_TOKEN` set → mutating routes 401 without bearer, GET still open.
- [ ] Implement; commit `feat(api): add REST endpoints with validation and optional bearer auth`.

### Task 12: Notifier

**Files:** Create `src/notify/{digest,telegram,email,index}.ts`. Test: `digest.test.ts`, `notify.test.ts`.

**Produces:** `buildDigest(input: DigestInput, lang: "hu" | "en"): { subject: string; text: string }` (Hungarian default; subject `Repjegy akciók – <date>`; last line exactly `Az árak gyorsan változnak, foglalás előtt ellenőrizd. Tájékoztató jellegű.`; empty → `ma nincs akció`; unavailable sources + exhausted quotas listed); `interface Notifier { name; send(d): Promise<void> }`; `createNotifiers(cfg, log): Notifier[]` (unconfigured → no-op + log).

- [ ] Tests: digest snapshot-free assertions on lines (route, dates, price via `Intl`, discount vs median and vs max, source, data age, deep link, quota remaining); Telegram 500 → run summary `notify: failed`, run `done` (Review Focus 5); `POST /api/notify/test` sends a test digest.
- [ ] Implement; commit `feat(api): add telegram and email digest notifiers`.

### Task 13: Seed, backfill, entrypoint

**Files:** Create `src/scripts/{seed,backfill}.ts`; modify `src/main.ts` (config, db, registry, scheduler, pino with key redaction). Scripts `db:seed`, `backfill`.

- [ ] Test: seed is idempotent (run twice → same 6 watches: BUD→LIS, BCN, LON, PAR, ROM, ANYWHERE).
- [ ] Manual: `DRY_RUN=true pnpm --filter @fdw/api dev`, `curl /api/health`, `POST /api/refresh` returns a run summary with fixture data.
- [ ] Commit `feat(api): add seed, backfill and server entrypoint`.

**Phase 4 checkpoint:** full checks, ponytail review, `docs/PROGRESS.md`, `docs/DATA_SOURCES.md` draft.

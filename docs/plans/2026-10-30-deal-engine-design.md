# Design: deal engine, providers, quota guard, verification pipeline

Status: approved for implementation (phase 2). Source of truth for requirements: the build prompt
(sections 4 to 6). Items marked _(my call)_ were decided during design, not by the owner; review them.

## Revision 1 (owner feedback, 2026-10-30)

Supersedes anything below that conflicts.

- **EUR only.** `Currency` is the literal `"EUR"`; no currency setting. Display still uses `Intl`.
- **Retries: at most 1** (2 attempts total) on network error / 429 / 5xx, backoff 1000 ms. Each
  attempt still reserves quota.
- **No Ignav, no e-mail.** Telegram is the only notification channel; `Notifier` stays an interface.
- **Hosting: everything on Vercel** (one project, Vercel Services: `apps/web` static SPA frontend,
  `apps/api` Fastify backend owning `/api`). Consequences:
  - Database: **Turso** (libSQL, Vercel Marketplace) through Drizzle's `libsql` driver; local dev and
    tests use `file:./data/fdw.db` / `:memory:` with the same client. Replaces `better-sqlite3`.
  - QuotaGuard `reserve` becomes async: an in-process mutex serialises callers, and each reservation
    runs in a libSQL `write` transaction (`BEGIN IMMEDIATE`), so concurrent function instances
    cannot both take the last slot.
  - Scheduler: **Vercel Cron** (`0 6 * * *` UTC, about 07:00/08:00 Budapest) calls
    `GET /api/cron/run` with `Authorization: Bearer $CRON_SECRET`. No `node-cron`, no always-on process.
  - The run must fit one function invocation (`maxDuration` 300 s): discovery is capped per run
    (`MAX_DISCOVERY_CALLS_PER_RUN`, default 60) and the run lock covers overlapping invocations.

## Intent

Find fares from BUD that are genuinely cheap, either below an absolute price the owner sets or far
below the route's own history, without ever lying about prices and without ever exceeding the tight
free-tier quotas. Honesty and quota safety beat coverage: a missed deal is acceptable, a fabricated
"40 % below average" or a surprise API bill is not.

Non-goals: real-time tracking, booking, payments, multi-user, FX conversion, scraping.

## 1. Shared domain (`packages/shared`)

### Schemas (`src/schemas`)

- `Iata`: `/^[A-Z]{3}$/`. `Destination` = `Iata | "ANYWHERE"`.
- `IsoDate`: `YYYY-MM-DD`, must be a real calendar date. `IsoDateTime`: ISO 8601 with offset.
- `Currency`: `"EUR" | "HUF" | "USD"`.
- `ProviderId`: `"travelpayouts" | "serpapi" | "ignav" | "fixture"`.
- `PriceObservation`:
  `{ source, isCached, observedAt, expiresAt?, currency, amount, origin, destination, departDate,
returnDate: IsoDate | null, stops, deepLink?, market? }`.
  Refinements: `amount` finite and `> 0`; `origin !== destination`; `returnDate >= departDate`;
  `departDate` not in the past relative to `observedAt` (date part); `stops` integer `0..4`;
  `deepLink` must be `https:`.
- `PriceInsights`: `{ level: "low" | "typical" | "high" | null, typicalLow: number | null,
typicalHigh: number | null }`.
- `Watch`, `WatchInput` (origin default `BUD`, destination, `monthsAhead` 1..12, optional
  `departFrom`/`departTo`, optional `minStay`/`maxStay` days, `tripType: "oneway" | "return"`,
  `maxStops`, `maxPrice`, `currency`, `active`).
- `Settings` with defaults (shown and edited on the Settings page):

  | key                  | default | meaning                                           |
  | -------------------- | ------- | ------------------------------------------------- |
  | `minObservations`    | 14      | history needed for median/percentile rules        |
  | `minSpanDays`        | 7       | first-to-last observation span needed             |
  | `medianWindowDays`   | 90      | rolling window                                    |
  | `belowMedianPct`     | 30      | `BELOW_MEDIAN_PCT` threshold                      |
  | `lowPercentile`      | 10      | `BELOW_P10` percentile                            |
  | `verifyTolerancePct` | 10      | live vs cached tolerance                          |
  | `verifyTopK`         | 5       | verifications per run                             |
  | `verifyCacheHours`   | 24      | do not re-verify the same route+dates within this |
  | `realertDropPct`     | 5       | re-alert only after this further drop             |
  | `alertCandidates`    | false   | also alert unverified candidates                  |
  | `currency`           | EUR     | query and display currency                        |
  | `language`           | hu      | UI and notification language default              |

### Currency _(my call)_

No FX conversion anywhere (converting would mean inventing prices). Providers are queried in the
configured currency. Stats and rules only ever compare observations with the same currency as the
fare under test. Changing the currency therefore starts a fresh history; the UI says so.

### Route key

`routeKey = origin-destination-tripType` (for example `BUD-LIS-return`). An `ANYWHERE` watch
produces one route per concrete destination it discovers. History for a fare = observations with the
same route key and currency, `observedAt` strictly before the current run started (the fare never
counts towards its own baseline).

### Statistics (`src/deals/stats.ts`)

- `median(values)`: standard median (mean of the two middle values for an even count).
- `percentile(values, p)`: **nearest-rank** method, so the result is always an observed price, never an
  interpolated one _(my call)_.
- `historyStats(history, { now, departMonth, settings })` returns
  `{ sufficiency: "ok" | "insufficient_history", count, spanDays, basis: "month" | "route" | null,
median: number | null, p10: number | null, min: number | null }`.
  - Window: observations with `observedAt >= now - medianWindowDays`.
  - Basis: if the subset with the same departure month (`YYYY-MM` of `departDate`) is itself
    sufficient, use it (`basis: "month"`); else the whole route window (`basis: "route"`).
  - Sufficient = `count >= minObservations && spanDays >= minSpanDays`. The span rule matters
    because one month-matrix call returns ~30 prices on the same day.
  - Insufficient: `median`, `p10`, `min` are `null`, never `0`.

### Rules (`src/deals/evaluate.ts`)

`evaluateFare({ amount, maxPrice, stats, insights? })` returns
`{ reasons: ReasonCode[], discountPct: number | null, belowMaxPct: number | null }`.

| code                       | fires when                                                   |
| -------------------------- | ------------------------------------------------------------ |
| `BELOW_MAX_PRICE`          | `amount <= maxPrice`                                         |
| `BELOW_MEDIAN_PCT`         | sufficient and `amount <= median * (1 - belowMedianPct/100)` |
| `BELOW_P10`                | sufficient and `amount < p10`                                |
| `NEW_ROUTE_LOW`            | sufficient and `amount < min`                                |
| `PROVIDER_PRICE_LEVEL_LOW` | sufficient and `insights.level === "low"`                    |

- Insufficient history: only `BELOW_MAX_PRICE` can fire, as the spec says. This includes
  `PROVIDER_PRICE_LEVEL_LOW`, although that signal does not depend on our history _(my call: literal
  reading; easy to relax later)_.
- `discountPct = round1((median - amount) / median * 100)`, `null` when insufficient.
- `belowMaxPct = round1((maxPrice - amount) / maxPrice * 100)`, `null` when no `maxPrice`.
- A fare is a deal when `reasons.length > 0`.

### Ranking, verification outcome, alerting (`src/deals/pipeline.ts`)

- `rankScore(deal) = max(discountPct ?? -Infinity, belowMaxPct ?? -Infinity)`; ties broken by lower
  amount. `pickForVerification(deals, k, recentlyVerified)` takes the top K by score, skipping
  route+dates verified within `verifyCacheHours`.
- `applyVerification(candidate, live | null, settings)`:
  - `live === null` (no price found, or the route is gone): `stale`.
  - `live.amount > candidate.amount * (1 + tol)`: `stale` (price gone).
  - Otherwise re-run `evaluateFare` on the **live** amount (a cheaper live price is fine). Non-empty
    reasons: `verified` with the live amount; empty: `stale`.
  - Provider error or quota exhausted: stays `candidate`, with the reason recorded (not stale: we
    did not learn anything about the price).
- `isAlertable(deal, settings)`: `verified`, or `candidate` when `alertCandidates`.
- `shouldAlert(deal, lastAlert)`: no previous alert for the same route+dates: `true`; else
  `deal.amount <= lastAlert.amount * (1 - realertDropPct/100)`.

All of the above are pure functions with a boundary test per rule.

## 2. Providers (`apps/api/src/providers`)

```ts
interface FlightPriceProvider {
  readonly id: ProviderId;
  discover?(q: DiscoverQuery, ctx: ProviderContext): Promise<ProviderResult>;
  verify?(q: VerifyQuery, ctx: ProviderContext): Promise<ProviderResult>;
}
type ProviderResult =
  | { ok: true; observations: PriceObservation[]; insights?: PriceInsights; dropped: number }
  | { ok: false; reason: string; kind: "unavailable" | "quota_exhausted" | "dry_run" };
```

- `DiscoverQuery`: `{ origin, destination: Destination, month: "YYYY-MM", tripType, currency, market }`.
- `VerifyQuery`: `{ origin, destination: Iata, departDate, returnDate, currency, maxStops }`.
- `ProviderContext`: `{ http, guard, cache, log, now }`, injected so tests use fixtures and a fake
  clock.
- Each provider = a thin request builder + a pure `parse*(json, observedAt)` function. Parsers are
  tested against small recorded fixtures (`src/providers/fixtures/*.json`, at most ~20 rows).
- Normalisation: every row goes through `PriceObservation.safeParse`; invalid rows are dropped, the
  count is returned as `dropped` and logged with a sample reason (never the raw key).
- `http.getJson(url, { headers, timeoutMs, retries, reserve })`: `AbortSignal.timeout`, retries on
  network error / 429 / 5xx with exponential backoff (500 ms, 1500 ms), max 2 retries. **`reserve()`
  is called before every attempt**, so retries consume quota too and can never sneak past a cap.
  URLs are logged with secret query params redacted.
- Registry from env: `DISCOVERY_PROVIDERS=travelpayouts`, `VERIFY_PROVIDERS=serpapi,ignav` (ordered).
  A provider without its key is `disabled`. Verification falls back to the next provider when one
  is unavailable or out of quota.
- Per-run provider status: `ok | unavailable | quota_exhausted | disabled | dry_run`, with reason,
  persisted on the run record and shown in UI and digest.

### travelpayouts (discovery)

Aviasales Data API, header `X-Access-Token`, `currency=eur|huf|usd`, explicit `market`
(default `hu`, env `TRAVELPAYOUTS_MARKET`). Endpoints: `/aviasales/v3/prices_for_dates` (route +
month), `/v2/prices/month-matrix` (per-day prices of a month), `/v1/city-directions` (cheapest
destinations from BUD, used for `ANYWHERE`), `/aviasales/v3/get_special_offers` (extra candidates).
All results `isCached: true`, `expiresAt` from the payload when present. Responses cached in
`provider_cache` for 24 h keyed by URL without token. Rate limiting: minimum interval between calls
(`TRAVELPAYOUTS_MIN_INTERVAL_MS`, default 1000). Coverage from BUD may be thin; documented.

### serpapi (verification)

`engine=google_flights`, `departure_id`, `arrival_id`, `outbound_date`, `return_date`, `type`
(1 return / 2 one-way), `currency`, `hl=en`, `stops` mapped from `maxStops`. Take the cheapest of
`best_flights` + `other_flights` within `maxStops`; `isCached: false`. `price_insights` mapped to
`PriceInsights`. Deep link: `search_metadata.google_flights_url` when present.

### ignav (optional verification)

Implemented only if its public API docs can be confirmed during phase 4; otherwise listed in
`DATA_SOURCES.md` as "not implemented" and left out of the registry _(my call: no guessing an API
shape)_. Default quota caps are 0, so it never spends money until the owner sets caps.

### DRY_RUN and fixtures _(my call)_

`DRY_RUN=true`: `QuotaGuard.reserve` refuses every network provider with kind `dry_run`, so no
network call is possible. A `fixture` provider replays the bundled fixtures through the real
parsers so the app can be demoed; its observations carry `source: "fixture"` and the UI labels them
as demo data. Fixture data is never written when `DRY_RUN` is off.

## 3. Quota guard (`apps/api/src/quota`)

Table `quota_ledger(id, provider, kind, at, day, month, status, run_id)`; `day` and `month` are
computed in `TZ_SCHEDULE` (default `Europe/Budapest`).

```ts
class QuotaGuard {
  reserve(provider: ProviderId, kind: "discover" | "verify"): Reservation | QuotaRefusal; // sync
  settle(r: Reservation, status: "ok" | "error"): void;
  remaining(provider): { dayUsed; dayCap; monthUsed; monthCap };
}
```

- `reserve` runs in a `BEGIN IMMEDIATE` better-sqlite3 transaction: count today's and this month's
  rows for the provider (all statuses, so failed attempts count), refuse if either count `>= cap`,
  else insert a `reserved` row. Synchronous, so concurrent async callers in one process serialise on
  the event loop, and `IMMEDIATE` covers a second process.
- Caps from env, defaults under free tiers: SerpApi 200/month, 15/day; Travelpayouts 10000/month,
  500/day; Ignav 0/0. A cap of 0 disables the provider.
- Month rollover: calendar month in `TZ_SCHEDULE`. SerpApi's own cycle may differ, which is why the
  default is 200, not 250.
- Clock injected for tests. Tests: exactly-at-cap refuses, cap-1 allows, day rollover, month rollover
  (Jan 31 23:59 to Feb 1 00:00 Budapest), `Promise.all` of 10 calls with cap 3 = exactly 3 provider
  calls, failed attempts still count, DRY_RUN refuses all.

## 4. Run pipeline (`apps/api/src/jobs/run.ts`)

Triggered by `node-cron` (`CRON_SCHEDULE`, default `0 7 * * *`, `TZ_SCHEDULE`) or
`POST /api/refresh`.

1. **Lock**: insert a `runs` row with `status=running`; refuse if another run is running (a running
   row older than 30 min is marked `failed` and ignored).
2. **Discover**: for each active watch and each month in its window, call discovery providers
   (cache first). Filter by the watch: dates in window, stay length, `maxStops`. Upsert observations;
   unique key `(source, origin, destination, departDate, returnDate, currency, observedDay)` keeps
   one row per day (latest price wins), so re-runs do not inflate history.
3. **Detect**: for each route+dates seen this run, compute `historyStats` from observations before
   the run start, then `evaluateFare`. Deals upsert into `deals` by
   `(watchId, routeKey, departDate, returnDate)` with status `candidate`, reasons, stats snapshot.
4. **Verify**: `pickForVerification` top K, then verification providers in order through the guard.
   The live price is stored as an observation (`isCached: false`); `applyVerification` sets
   `verified` / `stale` / stays `candidate`.
5. **Notify**: alertable deals passing `shouldAlert` form one digest. Sent when there is at least one
   new alert or no digest was sent yet today (so a re-run does not spam "ma nincs akció"). Alerts
   are recorded per route+dates with the amount.
6. **Finish**: run row gets `status=done|failed`, counts, provider statuses, quota remaining.

Re-running the same day: discovery hits the 24 h cache (no calls), observations dedupe, verification
is skipped by the 24 h rule, alerts dedupe. Safe and idempotent.

## Tables (Drizzle, SQLite)

`watches`, `observations`, `deals`, `alerts`, `quota_ledger`, `provider_cache`, `runs`, `settings`
(single JSON row validated by the `Settings` schema).

## Left to the builder

Column types and indexes, exact Fastify route layout, pino fields, notifier message formatting
details beyond section 8 of the prompt.

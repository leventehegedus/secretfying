# Data sources

Official APIs only. No scraping of Google, airline or OTA pages. Nothing here books or pays.

## Travelpayouts (discovery)

- Role: cheap-fare discovery from BUD. Source id `travelpayouts`. Requires `TRAVELPAYOUTS_TOKEN`.
- Used endpoint: `GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates`, token in the
  `X-Access-Token` header (never in the URL). Params: `origin`, `destination` (omitted for ANYWHERE),
  `departure_at` (YYYY-MM), `return_at` (YYYY-MM, return trips only), `one_way`, `direct=false`,
  `currency=eur`, `market` (`TRAVELPAYOUTS_MARKET`, default `hu`), `sorting=price`, `unique=false`,
  `limit=100`.
- Reference data (no token, not quota-metered): `https://api.travelpayouts.com/data/en/cities.json` and
  `airports.json`. Codes with `has_flightable_airport` / `flightable` true are kept; only the code list is
  cached (7 days).
- Not used: month-matrix, city-directions, special-offers (response format unconfirmed).
- Data nature: a 2-7 day cache of other users' searches, tied to a market. Prices are indicative
  (`isCached: true`), never booking-grade. Coverage from BUD may be thin.
- Our limits: responses cached 24 h in `provider_cache` (a cache hit costs no quota); minimum
  `TRAVELPAYOUTS_MIN_INTERVAL_MS` (default 1000) between live calls; daily/monthly caps via `QuotaGuard`.
- Deep link: `https://www.aviasales.com` + the row's `link`.

## Fixture (demo only)

Source id `fixture`, active only when `DRY_RUN=true`. Replays the bundled fixtures through the real
parsers, with dates shifted so the earliest departure is 30 days after "now" (demo data must not expire).

## Unconfirmed until the first approved live smoke test

- Travelpayouts: exact response shape of `prices_for_dates` (fixture follows the lead's description),
  the `link` to aviasales.com prefix, rate limits (600/min reported in a search snippet, not confirmed),
  data retention (2 to 7 days, sources conflict), whether the token is required for the reference files.
- support.travelpayouts.com returned HTTP 403 to automated fetches, so its pages were not verified.

## Adding a provider

1. Implement `FlightPriceProvider` (`discover` and/or `verify`) with a pure `parse*` function.
2. Add a small fixture (at most 20 rows) and a parser test, including dropped-row counting.
3. Add the id to `ProviderId` in `@fdw/shared`, quota caps to config/`QuotaCaps`, and register it in
   `src/providers/registry.ts`.

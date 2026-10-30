// Explicit dedupe keys: SQLite unique indexes treat NULLs as distinct, so one-way rows
// (returnDate null) would never collide on a composite index.
type ObsKeyInput = {
  source: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  currency: string;
  observedDay: string;
};

export const observationKey = (o: ObsKeyInput): string =>
  [
    o.source,
    o.origin,
    o.destination,
    o.departDate,
    o.returnDate ?? "-",
    o.currency,
    o.observedDay,
  ].join("|");

export const dealKey = (d: {
  watchId: number;
  routeKey: string;
  departDate: string;
  returnDate: string | null;
}): string => [d.watchId, d.routeKey, d.departDate, d.returnDate ?? "-"].join("|");

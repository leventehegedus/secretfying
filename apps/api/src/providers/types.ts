import type {
  Currency,
  Destination,
  Iata,
  IsoDate,
  PriceInsights,
  PriceObservation,
  TripType,
} from "@fdw/shared";
import type { ProviderId } from "@fdw/shared";
import type { QuotaGuard } from "../quota/guard.js";

export type DiscoverQuery = {
  origin: Iata;
  destination: Destination;
  month: string; // YYYY-MM
  tripType: TripType;
  currency: Currency;
  market: string;
};

export type VerifyQuery = {
  origin: Iata;
  destination: Iata;
  departDate: IsoDate;
  returnDate: IsoDate | null;
  currency: Currency;
  maxStops: number;
};

export type ProviderFailure = {
  ok: false;
  reason: string;
  kind: "unavailable" | "quota_exhausted" | "dry_run";
};
export type ProviderResult =
  | { ok: true; observations: PriceObservation[]; insights?: PriceInsights; dropped: number }
  | ProviderFailure;

export type Cache = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
};

export type ProviderContext = {
  guard: QuotaGuard;
  cache: Cache;
  log: (msg: string) => void;
  now: () => Date;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export interface FlightPriceProvider {
  readonly id: ProviderId;
  discover?(q: DiscoverQuery, ctx: ProviderContext): Promise<ProviderResult>;
  verify?(q: VerifyQuery, ctx: ProviderContext): Promise<ProviderResult>;
}

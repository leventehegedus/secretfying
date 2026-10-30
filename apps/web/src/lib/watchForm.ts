import { WatchInput } from "@fdw/shared";
import type { Watch } from "@fdw/shared";
import type { Issue } from "./api";

export type FormState = {
  origin: string;
  destination: string;
  tripType: "oneway" | "return";
  monthsAhead: string;
  departFrom: string;
  departTo: string;
  minStay: string;
  maxStay: string;
  maxStops: string;
  maxPrice: string;
  active: boolean;
};

export const EMPTY: FormState = {
  origin: "BUD",
  destination: "",
  tripType: "return",
  monthsAhead: "3",
  departFrom: "",
  departTo: "",
  minStay: "",
  maxStay: "",
  maxStops: "1",
  maxPrice: "",
  active: true,
};

const str = (n: number | null | undefined): string => (n == null ? "" : String(n));

export const fromWatch = (w: Watch): FormState => ({
  origin: w.origin,
  destination: w.destination,
  tripType: w.tripType,
  monthsAhead: str(w.monthsAhead),
  departFrom: w.departFrom ?? "",
  departTo: w.departTo ?? "",
  minStay: str(w.minStay),
  maxStay: str(w.maxStay),
  maxStops: str(w.maxStops),
  maxPrice: str(w.maxPrice),
  active: w.active,
});

export const toInput = (w: Watch): WatchInput => WatchInput.parse({ ...w });

const num = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s));

/** Validation is the shared schema; this only turns text fields into its input. */
export function parseForm(
  s: FormState,
): { ok: true; value: WatchInput } | { ok: false; issues: Issue[] } {
  const r = WatchInput.safeParse({
    origin: s.origin.trim().toUpperCase(),
    destination: s.destination.trim().toUpperCase() || undefined,
    tripType: s.tripType,
    monthsAhead: num(s.monthsAhead),
    departFrom: s.departFrom || undefined,
    departTo: s.departTo || undefined,
    minStay: num(s.minStay),
    maxStay: num(s.maxStay),
    maxStops: num(s.maxStops),
    maxPrice: num(s.maxPrice) ?? null,
    active: s.active,
  });
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

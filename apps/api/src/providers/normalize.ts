import { PriceObservation } from "@fdw/shared";

// Every provider row goes through the shared schema; invalid rows are dropped and counted.
export function normalize(
  rows: unknown[],
  log: (msg: string) => void,
): { observations: PriceObservation[]; dropped: number } {
  const observations: PriceObservation[] = [];
  let dropped = 0;
  let sample = "";
  for (const row of rows) {
    const r = PriceObservation.safeParse(row);
    if (r.success) observations.push(r.data);
    else {
      dropped++;
      sample ||= r.error.issues[0]?.message ?? "invalid";
    }
  }
  if (dropped > 0) log(`dropped ${dropped} invalid rows, e.g. ${sample}`);
  return { observations, dropped };
}

// en-CA formats as YYYY-MM-DD
export const dayIn = (tz: string, d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

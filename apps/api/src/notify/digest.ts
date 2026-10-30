import type { DealStatus, ProviderId, ProviderStatus, Settings } from "@fdw/shared";

export type DigestDeal = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  amount: number;
  discountPct: number | null;
  belowMaxPct: number | null;
  source: string;
  observedAt: string;
  deepLink: string | null;
  status: DealStatus;
};
export type DigestInput = {
  date: string; // YYYY-MM-DD
  now: Date;
  deals: DigestDeal[];
  quota: Partial<Record<ProviderId, { dayLeft: number; monthLeft: number }>>;
  statuses: Partial<Record<ProviderId, ProviderStatus>>;
};
export type Message = { subject: string; text: string };

export const MAX_DEALS = 10;
// Telegram limit is 4096; keep headroom.
const MAX_CHARS = 4000;

const T = {
  hu: {
    title: "Repjegy akciók",
    none: "ma nincs akció",
    oneway: "egy út",
    ret: "oda-vissza",
    verified: "élő ár, ellenőrizve",
    candidate: "előzetes (gyorsítótárból)",
    stale: "nem ellenőrizhető",
    median: (p: string) => `${p} a medián alatt`,
    noHistory: "nincs elég előzmény",
    max: (p: string) => `${p} a maximum ár alatt`,
    source: "Forrás",
    age: (h: number) => (h < 48 ? `${h} órás adat` : `${Math.floor(h / 24)} napos adat`),
    more: (n: number) => `és még ${n} akció`,
    quota: "Kvóta",
    left: (d: number, m: number) => `${d} hívás maradt ma, ${m} a hónapban`,
    exhausted: "Kimerült kvóta",
    unavailable: "Nem elérhető források",
    footer: "Az árak gyorsan változnak, foglalás előtt ellenőrizd. Tájékoztató jellegű.",
  },
  en: {
    title: "Flight deals",
    none: "no deals today",
    oneway: "one way",
    ret: "return",
    verified: "live price, verified",
    candidate: "indicative (cached)",
    stale: "could not be verified",
    median: (p: string) => `${p} below median`,
    noHistory: "not enough history",
    max: (p: string) => `${p} below your max price`,
    source: "Source",
    age: (h: number) => (h < 48 ? `${h} h old data` : `${Math.floor(h / 24)} d old data`),
    more: (n: number) => `and ${n} more`,
    quota: "Quota",
    left: (d: number, m: number) => `${d} calls left today, ${m} this month`,
    exhausted: "Exhausted quotas",
    unavailable: "Unavailable sources",
    footer: "Prices change fast; check before booking. For information only.",
  },
} as const;

export function buildDigest(input: DigestInput, lang: Settings["language"]): Message {
  const t = T[lang];
  const locale = lang === "hu" ? "hu-HU" : "en-GB";
  const eur = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dealLines = (d: DigestDeal, i: number): string[] => {
    const dates = d.returnDate
      ? `${d.departDate} – ${d.returnDate} (${t.ret})`
      : `${d.departDate} (${t.oneway})`;
    const hours = Math.max(
      0,
      Math.floor((input.now.getTime() - Date.parse(d.observedAt)) / 3_600_000),
    );
    return [
      `${i + 1}. ${d.origin} → ${d.destination}`,
      `   ${dates}`,
      `   ${eur.format(d.amount)} – ${t[d.status]}`,
      `   ${d.discountPct === null ? t.noHistory : t.median(`${pct.format(d.discountPct)}%`)}`,
      ...(d.belowMaxPct === null ? [] : [`   ${t.max(`${pct.format(d.belowMaxPct)}%`)}`]),
      `   ${t.source}: ${d.source}, ${t.age(hours)}`,
      ...(d.deepLink ? [`   ${d.deepLink}`] : []),
    ];
  };
  const metered = Object.entries(input.quota);
  const list = (title: string, ids: string[]) =>
    ids.length ? [`${title}: ${ids.join(", ")}`] : [];
  const tail = [
    ...(metered.length
      ? [t.quota, ...metered.map(([p, q]) => `  ${p}: ${t.left(q.dayLeft, q.monthLeft)}`)]
      : []),
    ...list(
      t.exhausted,
      metered.filter(([, q]) => q.dayLeft <= 0 || q.monthLeft <= 0).map(([p]) => p),
    ),
    ...list(
      t.unavailable,
      Object.entries(input.statuses)
        .filter(([, s]) => s === "unavailable")
        .map(([p]) => p),
    ),
    "",
    t.footer,
  ];
  const build = (n: number): string => {
    const shown = input.deals.slice(0, n);
    const body = shown.length === 0 ? [t.none] : shown.flatMap((d, i) => [...dealLines(d, i), ""]);
    const more = input.deals.length - shown.length;
    return [...body, ...(more > 0 ? [t.more(more), ""] : []), ...tail].join("\n");
  };
  let n = Math.min(MAX_DEALS, input.deals.length);
  while (n > 0 && build(n).length > MAX_CHARS) n--;
  return { subject: `${t.title} – ${input.date}`, text: build(n) };
}

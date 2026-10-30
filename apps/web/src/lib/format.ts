import type { Lang } from "@/i18n/dict";

const money = (lang: Lang) => new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" });

// Missing input gives null so the caller shows its "no data" text, never 0.
export const formatMoney = (amount: number | null | undefined, lang: Lang): string | null =>
  amount == null ? null : money(lang).format(amount);

export const formatDate = (iso: string | null | undefined, lang: Lang): string | null =>
  iso
    ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${iso.slice(0, 10)}T00:00:00Z`),
      )
    : null;

export const formatDateTime = (iso: string | null | undefined, lang: Lang): string | null =>
  iso
    ? new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(
        new Date(iso),
      )
    : null;

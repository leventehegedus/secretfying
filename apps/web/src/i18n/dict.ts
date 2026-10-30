export type Lang = "hu" | "en";

export const hu = {
  "app.title": "Repjegy akciók",
  "nav.dashboard": "Áttekintés",
  "nav.watches": "Figyelések",
  "nav.history": "Előzmények",
  "nav.settings": "Beállítások",
  "lang.switch": "English",
  "token.button": "Token",
  "token.title": "API token",
  "token.help": "Az írási műveletekhez kell. Csak ebben a böngészőben tárolódik.",
  "token.save": "Mentés",
  "token.clear": "Törlés",
  "token.invalid": "Hiányzó vagy érvénytelen token.",
  "common.noData": "nincs adat",
  "common.notEnoughHistory": "kevés adat",
  "common.demo": "demo",
  "common.cached": "gyorsítótár",
  "common.live": "élő",
  "common.loading": "Betöltés...",
  "common.error": "Hiba történt",
  "common.retry": "Újra",
  "common.save": "Mentés",
  "common.cancel": "Mégse",
  "common.close": "Bezár",
  "common.edit": "Szerkesztés",
  "common.delete": "Törlés",
  "dashboard.dealCount": "{n} ajánlat",
} as const;

export type Key = keyof typeof hu;

export const en: Record<Key, string> = {
  "app.title": "Flight deals",
  "nav.dashboard": "Dashboard",
  "nav.watches": "Watches",
  "nav.history": "History",
  "nav.settings": "Settings",
  "lang.switch": "Magyar",
  "token.button": "Token",
  "token.title": "API token",
  "token.help": "Required for write actions. Stored in this browser only.",
  "token.save": "Save",
  "token.clear": "Clear",
  "token.invalid": "Token missing or invalid.",
  "common.noData": "no data",
  "common.notEnoughHistory": "not enough history",
  "common.demo": "demo",
  "common.cached": "cached",
  "common.live": "live",
  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.retry": "Retry",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "dashboard.dealCount": "{n} deals",
};

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: Key, params?: Params): string {
  const text: string = (lang === "hu" ? hu : en)[key];
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => String(params[k] ?? m)) : text;
}

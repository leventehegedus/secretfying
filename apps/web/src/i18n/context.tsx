import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useSettings } from "@/lib/queries";
import { translate } from "./dict";
import type { Key, Lang, Params } from "./dict";

const KEY = "fdw.lang";
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, p?: Params) => string };
const I18n = createContext<Ctx | null>(null);

const stored = (): Lang | null => {
  const v = localStorage.getItem(KEY);
  return v === "hu" || v === "en" ? v : null;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Lang | null>(stored);
  const settings = useSettings();
  // Explicit choice wins, then the saved setting, then Hungarian.
  const lang = chosen ?? settings.data?.language ?? "hu";
  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    setChosen(l);
  };
  const value: Ctx = { lang, setLang, t: (k, p) => translate(lang, k, p) };
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18n);
  if (!c) throw new Error("useI18n outside LanguageProvider");
  return c;
}

export const useT = (): Ctx["t"] => useI18n().t;

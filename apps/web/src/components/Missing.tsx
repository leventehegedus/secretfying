import { useT } from "@/i18n/context";

/** Text for a value, or the translated "no data" marker when it is missing. */
export function Missing({ value }: { value: string | null | undefined }) {
  const t = useT();
  return value ? <>{value}</> : <span className="text-slate-400">{t("common.noData")}</span>;
}

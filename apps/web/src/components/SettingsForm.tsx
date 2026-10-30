import { DEFAULT_SETTINGS, Settings } from "@fdw/shared";
import { useState } from "react";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n/context";

type NumKey =
  | "minObservations"
  | "minSpanDays"
  | "medianWindowDays"
  | "belowMedianPct"
  | "lowPercentile"
  | "verifyTolerancePct"
  | "verifyTopK"
  | "verifyCacheHours"
  | "realertDropPct";
const NUM_KEYS: NumKey[] = [
  "minObservations",
  "minSpanDays",
  "medianWindowDays",
  "belowMedianPct",
  "lowPercentile",
  "verifyTolerancePct",
  "verifyTopK",
  "verifyCacheHours",
  "realertDropPct",
];

const toStrings = (s: Settings): Record<NumKey, string> => ({
  minObservations: String(s.minObservations),
  minSpanDays: String(s.minSpanDays),
  medianWindowDays: String(s.medianWindowDays),
  belowMedianPct: String(s.belowMedianPct),
  lowPercentile: String(s.lowPercentile),
  verifyTolerancePct: String(s.verifyTolerancePct),
  verifyTopK: String(s.verifyTopK),
  verifyCacheHours: String(s.verifyCacheHours),
  realertDropPct: String(s.realertDropPct),
});

type Props = { initial: Settings; pending: boolean; onSubmit: (s: Settings) => void };

export function SettingsForm({ initial, pending, onSubmit }: Props) {
  const t = useT();
  const [nums, setNums] = useState<Record<NumKey, string>>(() => toStrings(initial));
  const [alertCandidates, setAlert] = useState(initial.alertCandidates);
  const [language, setLanguage] = useState<Settings["language"]>(initial.language);
  const [bad, setBad] = useState<Set<string>>(new Set());

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const r = Settings.safeParse({
          ...Object.fromEntries(
            NUM_KEYS.map((k) => [k, nums[k].trim() === "" ? NaN : Number(nums[k])]),
          ),
          alertCandidates,
          language,
        });
        setBad(new Set(r.success ? [] : r.error.issues.map((i) => String(i.path[0]))));
        if (r.success) onSubmit(r.data);
      }}
    >
      {NUM_KEYS.map((k) => (
        <Field
          key={k}
          id={`s-${k}`}
          label={t(`settings.${k}`)}
          error={bad.has(k) ? t("settings.error.range") : undefined}
        >
          <Input
            id={`s-${k}`}
            type="number"
            value={nums[k]}
            onChange={(e) => setNums((s) => ({ ...s, [k]: e.target.value }))}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("settings.default", { value: DEFAULT_SETTINGS[k] })}
          </p>
        </Field>
      ))}
      <div className="flex items-center gap-2 text-sm">
        <Switch
          label={t("settings.alertCandidates")}
          checked={alertCandidates}
          onChange={setAlert}
        />
        {t("settings.alertCandidates")}
      </div>
      <Field id="s-language" label={t("settings.language")}>
        <Select
          id="s-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "hu")}
        >
          <option value="hu">Magyar</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

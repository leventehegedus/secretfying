import type { WatchInput } from "@fdw/shared";
import { useState } from "react";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n/context";
import type { Key } from "@/i18n/dict";
import type { Issue } from "@/lib/api";
import { usePlaces } from "@/lib/queries";
import { EMPTY, parseForm } from "@/lib/watchForm";
import type { FormState } from "@/lib/watchForm";

type Props = {
  initial?: FormState;
  issues: Issue[];
  pending: boolean;
  onSubmit: (input: WatchInput) => void;
  onCancel: () => void;
};

type TextField = Exclude<keyof FormState, "active" | "tripType">;
const TEXT_FIELDS: { name: TextField; key: Key; type: string }[] = [
  { name: "origin", key: "watch.origin", type: "text" },
  { name: "destination", key: "watch.destination", type: "text" },
  { name: "monthsAhead", key: "watch.monthsAhead", type: "number" },
  { name: "departFrom", key: "watch.departFrom", type: "date" },
  { name: "departTo", key: "watch.departTo", type: "date" },
  { name: "minStay", key: "watch.minStay", type: "number" },
  { name: "maxStay", key: "watch.maxStay", type: "number" },
  { name: "maxStops", key: "watch.maxStops", type: "number" },
  { name: "maxPrice", key: "watch.maxPrice", type: "number" },
];

export function WatchForm({ initial = EMPTY, issues, pending, onSubmit, onCancel }: Props) {
  const t = useT();
  const [state, setState] = useState<FormState>(initial);
  const [clientIssues, setClientIssues] = useState<Issue[]>([]);
  const places = usePlaces(state.destination);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const all = [...clientIssues, ...issues];
  const msg = (m: string) => (m === "invalid stay length" ? t("watch.error.stay") : m);
  const errorOf = (path: string) => {
    const i = all.find((x) => x.path === path);
    return i && msg(i.message);
  };
  const formLevel = all.filter((i) => i.path === "");

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const r = parseForm(state);
        setClientIssues(r.ok ? [] : r.issues);
        if (r.ok) onSubmit(r.value);
      }}
    >
      {TEXT_FIELDS.map((f) => (
        <Field key={f.name} id={`w-${f.name}`} label={t(f.key)} error={errorOf(f.name)}>
          <Input
            id={`w-${f.name}`}
            type={f.type}
            value={state[f.name]}
            list={f.name === "destination" ? "w-places" : undefined}
            onChange={(e) => set(f.name, e.target.value)}
          />
        </Field>
      ))}
      <datalist id="w-places">
        <option value="ANYWHERE">{t("watch.anywhere")}</option>
        {places.data?.map((p) => (
          <option key={`${p.kind}-${p.code}`} value={p.code}>
            {p.name}
          </option>
        ))}
      </datalist>
      <Field id="w-tripType" label={t("watch.tripType")} error={errorOf("tripType")}>
        <Select
          id="w-tripType"
          value={state.tripType}
          onChange={(e) => set("tripType", e.target.value === "oneway" ? "oneway" : "return")}
        >
          <option value="return">{t("trip.return")}</option>
          <option value="oneway">{t("trip.oneway")}</option>
        </Select>
      </Field>
      <div className="flex items-center gap-2 text-sm">
        <Switch
          label={t("watch.active")}
          checked={state.active}
          onChange={(v) => set("active", v)}
        />
        {t("watch.active")}
      </div>
      {formLevel.map((i) => (
        <p key={i.message} role="alert" className="text-sm text-red-700">
          {msg(i.message)}
        </p>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

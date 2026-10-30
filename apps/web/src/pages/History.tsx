import { DealStatus } from "@fdw/shared";
import { useState } from "react";
import { DealsTable } from "@/components/DealsTable";
import { Field } from "@/components/Field";
import { QueryBoundary } from "@/components/QueryBoundary";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/context";
import { useDeals } from "@/lib/queries";

export function History() {
  const t = useT();
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const parsed = DealStatus.safeParse(status);
  const deals = useDeals({
    status: parsed.success ? parsed.data : undefined,
    from: from || undefined,
    to: to || undefined,
  });
  return (
    <>
      <h1 className="text-xl font-semibold">{t("history.title")}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="h-from" label={t("history.from")}>
          <Input id="h-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="h-to" label={t("history.to")}>
          <Input id="h-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field id="h-status" label={t("history.status")}>
          <Select id="h-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("history.all")}</option>
            {DealStatus.options.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <QueryBoundary query={deals}>{(list) => <DealsTable deals={list} />}</QueryBoundary>
    </>
  );
}

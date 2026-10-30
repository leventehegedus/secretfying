import { Missing } from "@/components/Missing";
import { QueryBoundary } from "@/components/QueryBoundary";
import { Card, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/context";
import { useQuota } from "@/lib/queries";
import type { Quota } from "@/lib/schemas";

// A cap of 0 means the provider is not metered or disabled: no limit data.
function left(used: number, cap: number, t: ReturnType<typeof useT>): string | null {
  return cap > 0 ? t("quota.remaining", { left: Math.max(cap - used, 0), cap }) : null;
}

export function QuotaCard() {
  const t = useT();
  const query = useQuota();
  return (
    <Card>
      <CardTitle>{t("dashboard.quota")}</CardTitle>
      <QueryBoundary query={query}>
        {(quota: Quota) => (
          <dl className="space-y-2 text-sm">
            {Object.entries(quota).map(([name, u]) => (
              <div key={name}>
                <dt className="font-medium">{name}</dt>
                <dd>
                  {t("quota.day")}: <Missing value={left(u.dayUsed, u.dayCap, t)} />
                </dd>
                <dd>
                  {t("quota.month")}: <Missing value={left(u.monthUsed, u.monthCap, t)} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </QueryBoundary>
    </Card>
  );
}

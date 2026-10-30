import { DealsTable } from "@/components/DealsTable";
import { LastRunCard } from "@/components/LastRunCard";
import { QueryBoundary } from "@/components/QueryBoundary";
import { QuotaCard } from "@/components/QuotaCard";
import { RefreshButton } from "@/components/RefreshButton";
import { useT } from "@/i18n/context";
import { useDeals } from "@/lib/queries";

export function Dashboard() {
  const t = useT();
  const deals = useDeals();
  return (
    <>
      <RefreshButton />
      <div className="grid gap-4 md:grid-cols-2">
        <LastRunCard />
        <QuotaCard />
      </div>
      <h2 className="text-lg font-semibold">{t("dashboard.deals")}</h2>
      <QueryBoundary query={deals}>
        {/* shortcut: the API has no limit, stale rows are filtered here; add paging when the list grows. */}
        {(all) => <DealsTable deals={all.filter((d) => d.status !== "stale")} />}
      </QueryBoundary>
    </>
  );
}

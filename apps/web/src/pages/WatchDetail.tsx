import { useState } from "react";
import { Link, useParams } from "react-router";
import { ObservationsTable } from "@/components/ObservationsTable";
import { PriceChart } from "@/components/PriceChart";
import { QueryBoundary } from "@/components/QueryBoundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n/context";
import { usePrices, useWatches } from "@/lib/queries";
import { RANGES } from "@/lib/schemas";
import type { Prices, Range } from "@/lib/schemas";

const LATEST = 20;

function Body({ prices }: { prices: Prices }) {
  const t = useT();
  const last = prices.stats.at(-1);
  if (prices.series.length === 0) return <p className="text-sm">{t("detail.empty")}</p>;
  return (
    <>
      {(!last || last.sufficiency === "insufficient_history") && (
        <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          {t("detail.insufficient")}
        </p>
      )}
      <Card className="overflow-x-auto">
        <PriceChart prices={prices} />
      </Card>
      <h2 className="text-lg font-semibold">{t("detail.latest")}</h2>
      <ObservationsTable rows={prices.series.slice(-LATEST).reverse()} />
    </>
  );
}

export function WatchDetail() {
  const t = useT();
  const id = Number(useParams().id);
  const [range, setRange] = useState<Range>("90d");
  const watches = useWatches();
  const prices = usePrices(id, range);
  const watch = watches.data?.find((w) => w.id === id);
  return (
    <>
      <Link className="text-sm underline" to="/watches">
        {t("detail.back")}
      </Link>
      <h1 className="text-xl font-semibold">
        {watch ? `${watch.origin} → ${watch.destination}` : `#${id}`}
      </h1>
      <div className="flex gap-2" role="tablist">
        {RANGES.map((r) => (
          <Button
            key={r}
            role="tab"
            aria-selected={r === range}
            variant={r === range ? "default" : "outline"}
            onClick={() => setRange(r)}
          >
            {t(`detail.range.${r}`)}
          </Button>
        ))}
      </div>
      <QueryBoundary query={prices}>{(p) => <Body prices={p} />}</QueryBoundary>
    </>
  );
}

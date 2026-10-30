import type { Deal } from "@fdw/shared";
import { Missing } from "@/components/Missing";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useI18n } from "@/i18n/context";
import { formatDate, formatMoney } from "@/lib/format";

function PriceKind({ deal }: { deal: Deal }) {
  const { t } = useI18n();
  if (deal.source === "fixture") return <Badge tone="blue">{t("common.demo")}</Badge>;
  return <Badge>{t(deal.status === "verified" ? "common.live" : "common.cached")}</Badge>;
}

function DealRow({ deal }: { deal: Deal }) {
  const { lang, t } = useI18n();
  const dates = [deal.departDate, deal.returnDate].map((d) => formatDate(d, lang));
  return (
    <Tr>
      <Td>
        {deal.origin} → {deal.destination}
        <div className="text-xs text-slate-500">{t(`trip.${deal.tripType}`)}</div>
      </Td>
      <Td>
        {dates[0]}
        {deal.tripType === "return" && (
          <>
            {" – "}
            <Missing value={dates[1]} />
          </>
        )}
      </Td>
      <Td>
        <Missing value={formatMoney(deal.amount, lang)} /> <PriceKind deal={deal} />
      </Td>
      <Td>
        <Missing value={deal.discountPct == null ? null : `${Math.round(deal.discountPct)} %`} />
      </Td>
      <Td className="space-x-1">
        {deal.reasons.map((r) => (
          <Badge key={r}>{t(`reason.${r}`)}</Badge>
        ))}
      </Td>
      <Td>
        <StatusBadge status={deal.status} />
      </Td>
    </Tr>
  );
}

export function DealsTable({ deals }: { deals: Deal[] }) {
  const t = useI18n().t;
  if (deals.length === 0) return <p className="text-sm text-slate-500">{t("deals.empty")}</p>;
  return (
    <Table>
      <THead>
        <Tr>
          {(["route", "dates", "price", "discount", "reasons", "status"] as const).map((k) => (
            <Th key={k}>{t(`deals.${k}`)}</Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {deals.map((d) => (
          <DealRow key={d.id} deal={d} />
        ))}
      </TBody>
    </Table>
  );
}

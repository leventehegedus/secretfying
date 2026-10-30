import { Missing } from "@/components/Missing";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useI18n } from "@/i18n/context";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Observation } from "@/lib/schemas";

function Kind({ o }: { o: Observation }) {
  const t = useI18n().t;
  if (o.source === "fixture") return <Badge tone="blue">{t("common.demo")}</Badge>;
  return <Badge>{t(o.isCached ? "common.cached" : "common.live")}</Badge>;
}

export function ObservationsTable({ rows }: { rows: Observation[] }) {
  const { lang, t } = useI18n();
  return (
    <Table>
      <THead>
        <Tr>
          <Th>{t("detail.observed")}</Th>
          <Th>{t("deals.dates")}</Th>
          <Th>{t("detail.price")}</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((o) => (
          <Tr key={`${o.observedAt}-${o.departDate}-${o.returnDate}-${o.amount}-${o.source}`}>
            <Td>
              <Missing value={formatDateTime(o.observedAt, lang)} />
            </Td>
            <Td>
              {formatDate(o.departDate, lang)}
              {o.returnDate && ` – ${formatDate(o.returnDate, lang)}`}
            </Td>
            <Td>
              <Missing value={formatMoney(o.amount, lang)} /> <Kind o={o} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

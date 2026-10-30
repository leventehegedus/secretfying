import type { Watch } from "@fdw/shared";
import { Link } from "react-router";
import { Missing } from "@/components/Missing";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Td, Tr } from "@/components/ui/table";
import { useI18n } from "@/i18n/context";
import { formatMoney } from "@/lib/format";
import { useSaveWatch } from "@/lib/queries";
import { toInput } from "@/lib/watchForm";

type Props = { watch: Watch; onEdit: () => void; onDelete: () => void };

export function WatchRow({ watch, onEdit, onDelete }: Props) {
  const { lang, t } = useI18n();
  const save = useSaveWatch(watch.id);
  return (
    <Tr>
      <Td>
        <Link className="font-medium underline" to={`/watches/${watch.id}`}>
          {watch.origin} → {watch.destination}
        </Link>
      </Td>
      <Td>{t(`trip.${watch.tripType}`)}</Td>
      <Td>
        <Missing value={formatMoney(watch.maxPrice, lang)} />
      </Td>
      <Td>
        <Switch
          label={t("watch.active")}
          checked={watch.active}
          disabled={save.isPending}
          onChange={(active) => save.mutate({ ...toInput(watch), active })}
        />
      </Td>
      <Td className="space-x-2 text-right">
        <Button variant="outline" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button variant="outline" onClick={onDelete}>
          {t("common.delete")}
        </Button>
      </Td>
    </Tr>
  );
}

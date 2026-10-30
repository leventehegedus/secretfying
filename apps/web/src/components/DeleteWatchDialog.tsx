import type { Watch } from "@fdw/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/i18n/context";
import { useDeleteWatch } from "@/lib/queries";

type Props = { watch: Watch; onClose: () => void };

export function DeleteWatchDialog({ watch, onClose }: Props) {
  const t = useT();
  const del = useDeleteWatch();
  return (
    <Dialog open title={t("common.delete")} onClose={onClose}>
      <p className="mb-4 text-sm">
        {t("watch.deleteConfirm", { route: `${watch.origin} → ${watch.destination}` })}
      </p>
      {del.error && (
        <p role="alert" className="mb-2 text-sm text-red-700">
          {del.error.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="destructive"
          disabled={del.isPending}
          onClick={() => del.mutate(watch.id, { onSuccess: onClose })}
        >
          {t("common.delete")}
        </Button>
      </div>
    </Dialog>
  );
}

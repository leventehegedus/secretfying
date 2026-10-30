import type { Watch } from "@fdw/shared";
import { useState } from "react";
import { DeleteWatchDialog } from "@/components/DeleteWatchDialog";
import { QueryBoundary } from "@/components/QueryBoundary";
import { WatchDialog } from "@/components/WatchDialog";
import { WatchRow } from "@/components/WatchRow";
import { Button } from "@/components/ui/button";
import { Table, TBody, Th, THead, Tr } from "@/components/ui/table";
import { useT } from "@/i18n/context";
import { useWatches } from "@/lib/queries";

type Dialog = { kind: "edit"; watch?: Watch } | { kind: "delete"; watch: Watch } | null;

export function Watches() {
  const t = useT();
  const watches = useWatches();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("watch.title")}</h1>
        <Button onClick={() => setDialog({ kind: "edit" })}>{t("watch.new")}</Button>
      </div>
      <QueryBoundary query={watches}>
        {(list) =>
          list.length === 0 ? (
            <p className="text-sm text-slate-500">{t("watch.empty")}</p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>{t("deals.route")}</Th>
                  <Th>{t("watch.tripType")}</Th>
                  <Th>{t("watch.maxPrice")}</Th>
                  <Th>{t("watch.active")}</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {list.map((w) => (
                  <WatchRow
                    key={w.id}
                    watch={w}
                    onEdit={() => setDialog({ kind: "edit", watch: w })}
                    onDelete={() => setDialog({ kind: "delete", watch: w })}
                  />
                ))}
              </TBody>
            </Table>
          )
        }
      </QueryBoundary>
      {dialog?.kind === "edit" && <WatchDialog watch={dialog.watch} onClose={close} />}
      {dialog?.kind === "delete" && <DeleteWatchDialog watch={dialog.watch} onClose={close} />}
    </>
  );
}

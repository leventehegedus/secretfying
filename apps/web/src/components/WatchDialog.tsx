import type { Watch } from "@fdw/shared";
import { WatchForm } from "@/components/WatchForm";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/i18n/context";
import { ApiError } from "@/lib/api";
import { useSaveWatch } from "@/lib/queries";
import { fromWatch } from "@/lib/watchForm";

type Props = { watch?: Watch | undefined; onClose: () => void };

/** Mounted only while open, so the form state resets on every open. */
export function WatchDialog({ watch, onClose }: Props) {
  const t = useT();
  const save = useSaveWatch(watch?.id);
  const error = save.error;
  const issues = error instanceof ApiError ? error.issues : [];
  return (
    <Dialog open title={t(watch ? "watch.editTitle" : "watch.new")} onClose={onClose}>
      <WatchForm
        {...(watch && { initial: fromWatch(watch) })}
        issues={issues}
        pending={save.isPending}
        onCancel={onClose}
        onSubmit={(input) => save.mutate(input, { onSuccess: onClose })}
      />
      {error && issues.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error instanceof ApiError && error.isAuth ? t("token.invalid") : error.message}
        </p>
      )}
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";
import { useNotifyTest } from "@/lib/queries";

export function NotifyTest() {
  const t = useT();
  const test = useNotifyTest();
  const channels = test.data?.channels;
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
        {t("settings.notifyTest")}
      </Button>
      {test.error && (
        <p role="alert" className="text-sm text-red-700">
          {test.error.message}
        </p>
      )}
      {channels?.length === 0 && <p className="text-sm">{t("settings.notifyNone")}</p>}
      {channels?.map((c) => (
        <p key={c.name} className={c.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
          {c.ok
            ? t("settings.notifySent", { name: c.name })
            : t("settings.notifyFailed", { name: c.name, error: c.error ?? "" })}
        </p>
      ))}
    </div>
  );
}

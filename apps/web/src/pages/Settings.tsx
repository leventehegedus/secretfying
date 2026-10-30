import { NotifyTest } from "@/components/NotifyTest";
import { QueryBoundary } from "@/components/QueryBoundary";
import { SettingsForm } from "@/components/SettingsForm";
import { TokenManager } from "@/components/TokenManager";
import { Card, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/context";
import { ApiError } from "@/lib/api";
import { useSaveSettings, useSettings } from "@/lib/queries";

export function Settings() {
  const t = useT();
  const settings = useSettings();
  const save = useSaveSettings();
  const err = save.error;
  return (
    <>
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <Card>
        <QueryBoundary query={settings}>
          {(s) => (
            <>
              <SettingsForm initial={s} pending={save.isPending} onSubmit={(v) => save.mutate(v)} />
              {save.isSuccess && (
                <p role="status" className="mt-2 text-sm text-green-700">
                  {t("settings.saved")}
                </p>
              )}
              {err && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {err instanceof ApiError && err.isAuth ? t("token.invalid") : err.message}
                </p>
              )}
            </>
          )}
        </QueryBoundary>
      </Card>
      <Card>
        <CardTitle>{t("settings.notify")}</CardTitle>
        <NotifyTest />
      </Card>
      <Card>
        <CardTitle>{t("settings.token")}</CardTitle>
        <TokenManager />
      </Card>
    </>
  );
}

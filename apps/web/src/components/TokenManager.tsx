import { Button } from "@/components/ui/button";
import { setToken, setTokenDialog, useToken } from "@/lib/auth";
import { useT } from "@/i18n/context";

export function TokenManager() {
  const t = useT();
  const token = useToken();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{token ? t("settings.tokenSet") : t("settings.tokenUnset")}</span>
      <Button variant="outline" onClick={() => setTokenDialog(true)}>
        {t("settings.tokenEdit")}
      </Button>
      <Button variant="outline" disabled={!token} onClick={() => setToken(null)}>
        {t("settings.tokenClear")}
      </Button>
    </div>
  );
}

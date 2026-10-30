import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";
import type { Key } from "@/i18n/dict";
import { ApiError } from "@/lib/api";
import { useRefresh } from "@/lib/queries";

function errorKey(e: Error): Key | null {
  if (!(e instanceof ApiError)) return null;
  if (e.isAuth) return "token.invalid";
  if (e.status === 409) return "refresh.busy";
  if (e.status === 429) return "refresh.tooSoon";
  return null;
}

export function RefreshButton() {
  const t = useT();
  const refresh = useRefresh();
  const key = refresh.error ? errorKey(refresh.error) : null;
  return (
    <div className="flex items-center gap-3">
      <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
        {t(refresh.isPending ? "refresh.running" : "refresh.button")}
      </Button>
      {refresh.error && (
        <span role="alert" className="text-sm text-red-700">
          {key ? t(key) : refresh.error.message}
        </span>
      )}
    </div>
  );
}

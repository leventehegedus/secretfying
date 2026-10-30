import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";

type Props<T> = { query: UseQueryResult<T>; children: (data: T) => ReactNode };

export function QueryBoundary<T>({ query, children }: Props<T>) {
  const t = useT();
  if (query.isPending) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  if (query.isError)
    return (
      <p className="text-sm text-red-700">
        {t("common.error")}: {query.error.message}{" "}
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("common.retry")}
        </Button>
      </p>
    );
  return <>{children(query.data)}</>;
}

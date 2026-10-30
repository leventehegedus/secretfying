import type { ProviderStatus } from "@fdw/shared";
import { Missing } from "@/components/Missing";
import { QueryBoundary } from "@/components/QueryBoundary";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/context";
import { formatDateTime } from "@/lib/format";
import { useRunStatus } from "@/lib/queries";
import type { Run } from "@/lib/schemas";

const runTone: Record<Run["status"], Tone> = { running: "blue", done: "green", failed: "red" };
const providerTone: Record<ProviderStatus, Tone> = {
  ok: "green",
  disabled: "neutral",
  dry_run: "blue",
  quota_exhausted: "amber",
  unavailable: "red",
};

function num(n: number | undefined) {
  return n === undefined ? null : String(n);
}

function RunBody({ run }: { run: Run }) {
  const { lang, t } = useI18n();
  const s = run.summary;
  const counts = [
    ["run.started", formatDateTime(run.startedAt, lang)],
    ["run.finished", formatDateTime(run.finishedAt, lang)],
    ["run.stored", num(s?.stored)],
    ["run.dealsFound", num(s?.deals)],
    ["run.verified", num(s?.verified)],
    ["run.stale", num(s?.stale)],
  ] as const;
  return (
    <div className="space-y-2 text-sm">
      <Badge tone={runTone[run.status]}>{t(`run.status.${run.status}`)}</Badge>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {counts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{t(k)}</dt>
            <dd>
              <Missing value={v} />
            </dd>
          </div>
        ))}
      </dl>
      {s?.error && (
        <p className="text-red-700">
          {t("run.error")}: {s.error}
        </p>
      )}
      <div className="space-x-1">
        {Object.entries(s?.providers ?? {}).map(([name, st]) => (
          <Badge key={name} tone={providerTone[st]}>
            {name}: {t(`provider.status.${st}`)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function LastRunCard() {
  const t = useI18n().t;
  const query = useRunStatus();
  return (
    <Card>
      <CardTitle>{t("dashboard.lastRun")}</CardTitle>
      <QueryBoundary query={query}>
        {(run) => (run ? <RunBody run={run} /> : <p className="text-sm">{t("dashboard.noRun")}</p>)}
      </QueryBoundary>
    </Card>
  );
}

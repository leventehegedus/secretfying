import type { DealStatus } from "@fdw/shared";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/badge";
import { useT } from "@/i18n/context";

const tone: Record<DealStatus, Tone> = { candidate: "amber", verified: "green", stale: "neutral" };

export function StatusBadge({ status }: { status: DealStatus }) {
  const t = useT();
  return <Badge tone={tone[status]}>{t(`status.${status}`)}</Badge>;
}

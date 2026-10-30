import type { ProviderId } from "@fdw/shared";
import { getJson, QuotaError } from "./http.js";
import type { ProviderContext, ProviderFailure } from "./types.js";

type Opts = { headers?: Record<string, string>; redact?: string[] };

// Reserves quota before every attempt, settles each reservation, and maps failures to a ProviderFailure.
export async function guardedGet(
  ctx: ProviderContext,
  id: ProviderId,
  kind: "discover" | "verify",
  url: string,
  opts: Opts = {},
): Promise<{ ok: true; json: unknown } | ProviderFailure> {
  const ids: number[] = [];
  const reserve = async () => {
    const r = await ctx.guard.reserve(id, kind);
    if (!r.ok) throw new QuotaError(r.kind, r.reason);
    ids.push(r.id);
  };
  const settleAll = async (lastOk: boolean) => {
    for (const [i, rid] of ids.entries()) {
      await ctx.guard.settle(rid, lastOk && i === ids.length - 1 ? "ok" : "error");
    }
  };
  try {
    const json = await getJson(url, { ...opts, reserve, fetchFn: ctx.fetchFn, sleep: ctx.sleep });
    await settleAll(true);
    return { ok: true, json };
  } catch (e) {
    await settleAll(false);
    if (e instanceof QuotaError) return { ok: false, kind: e.kind, reason: e.message };
    return { ok: false, kind: "unavailable", reason: e instanceof Error ? e.message : "failed" };
  }
}

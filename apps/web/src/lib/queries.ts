import { Deal, Settings, Watch } from "@fdw/shared";
import type { DealStatus, WatchInput } from "@fdw/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./api";
import { Place, Prices, Providers, Quota, Run } from "./schemas";
import type { Range } from "./schemas";

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => api("/settings", Settings) });

export type DealFilter = {
  status?: DealStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export function useDeals(filter: DealFilter = {}) {
  const qs = new URLSearchParams(
    Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return useQuery({
    queryKey: ["deals", filter],
    queryFn: () => api(`/deals${qs ? `?${qs}` : ""}`, z.array(Deal)),
  });
}

export const useRunStatus = () =>
  useQuery({
    queryKey: ["run"],
    queryFn: () => api("/refresh/status", Run.nullable()),
  });

export const useQuota = () =>
  useQuery({ queryKey: ["quota"], queryFn: () => api("/quota", Quota) });

export const useProviders = () =>
  useQuery({ queryKey: ["providers"], queryFn: () => api("/providers", Providers) });

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/refresh", z.unknown(), { method: "POST" }),
    onSettled: () => qc.invalidateQueries(),
  });
}

export const useWatches = () =>
  useQuery({ queryKey: ["watches"], queryFn: () => api("/watches", z.array(Watch)) });

export const usePlaces = (q: string) =>
  useQuery({
    queryKey: ["places", q],
    queryFn: () => api(`/places?q=${encodeURIComponent(q)}`, z.array(Place)),
    enabled: q.trim().length >= 2,
  });

export function useSaveWatch(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WatchInput) =>
      id === undefined
        ? api("/watches", Watch, { method: "POST", body: input })
        : api(`/watches/${id}`, Watch, { method: "PUT", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watches"] }),
  });
}

export function useDeleteWatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/watches/${id}`, z.undefined(), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watches"] }),
  });
}

export const usePrices = (id: number, range: Range) =>
  useQuery({
    queryKey: ["prices", id, range],
    queryFn: () => api(`/watches/${id}/prices?range=${range}`, Prices),
  });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api("/settings", Settings, { method: "PUT", body: s }),
    onSuccess: (saved) => qc.setQueryData(["settings"], saved),
  });
}

const NotifyResult = z.object({
  channels: z.array(z.object({ name: z.string(), ok: z.boolean(), error: z.string().optional() })),
});

export const useNotifyTest = () =>
  useMutation({ mutationFn: () => api("/notify/test", NotifyResult, { method: "POST" }) });

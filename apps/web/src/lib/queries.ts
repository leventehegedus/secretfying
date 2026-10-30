import { Deal, Settings } from "@fdw/shared";
import type { DealStatus } from "@fdw/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./api";
import { Providers, Quota, Run } from "./schemas";

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

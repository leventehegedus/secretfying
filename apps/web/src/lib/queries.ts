import { Settings } from "@fdw/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => api("/settings", Settings) });

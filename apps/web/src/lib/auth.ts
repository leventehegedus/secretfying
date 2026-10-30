import { useSyncExternalStore } from "react";

const KEY = "fdw.token";
const listeners = new Set<() => void>();
let dialogOpen = false;
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const getToken = (): string | null => localStorage.getItem(KEY);

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
  emit();
}

export function setTokenDialog(open: boolean): void {
  dialogOpen = open;
  emit();
}

export const useToken = (): string | null => useSyncExternalStore(subscribe, getToken);
export const useTokenDialogOpen = (): boolean => useSyncExternalStore(subscribe, () => dialogOpen);

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type Props = { id: string; label: string; error?: string | undefined; children: ReactNode };

export function Field({ id, label, error, children }: Props) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

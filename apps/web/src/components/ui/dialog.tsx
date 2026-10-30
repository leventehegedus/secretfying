import type { ReactNode } from "react";

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode };

export function Dialog({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-lg"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

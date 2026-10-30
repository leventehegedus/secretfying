import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "destructive" | "ghost";
const styles: Record<Variant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-700",
  outline: "border border-slate-300 bg-white hover:bg-slate-100",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  ghost: "hover:bg-slate-100",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "default", className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
}

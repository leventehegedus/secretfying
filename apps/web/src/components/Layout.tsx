import { NavLink, Outlet } from "react-router";
import { TokenDialog } from "@/components/TokenDialog";
import { Button } from "@/components/ui/button";
import { setTokenDialog, useToken } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/context";
import type { Key } from "@/i18n/dict";

const links: { to: string; key: Key }[] = [
  { to: "/", key: "nav.dashboard" },
  { to: "/watches", key: "nav.watches" },
  { to: "/history", key: "nav.history" },
  { to: "/settings", key: "nav.settings" },
];

export function Layout() {
  const { lang, setLang, t } = useI18n();
  const token = useToken();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t("app.title")}</span>
          <nav className="flex flex-1 gap-3 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => cn("hover:underline", isActive && "font-semibold")}
              >
                {t(l.key)}
              </NavLink>
            ))}
          </nav>
          <Button variant="outline" onClick={() => setTokenDialog(true)}>
            {t("token.button")} {token ? "✓" : ""}
          </Button>
          <Button variant="outline" onClick={() => setLang(lang === "hu" ? "en" : "hu")}>
            {t("lang.switch")}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Outlet />
      </main>
      <TokenDialog />
    </div>
  );
}

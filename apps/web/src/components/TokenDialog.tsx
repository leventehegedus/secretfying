import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { setToken, setTokenDialog, useToken, useTokenDialogOpen } from "@/lib/auth";
import { useT } from "@/i18n/context";

function TokenForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const current = useToken();
  const [value, setValue] = useState(current ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setToken(value.trim() || null);
        onClose();
      }}
    >
      <p className="text-sm text-slate-600">{t("token.help")}</p>
      <Input
        type="password"
        autoComplete="off"
        aria-label={t("token.title")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setToken(null);
            onClose();
          }}
        >
          {t("token.clear")}
        </Button>
        <Button type="submit">{t("token.save")}</Button>
      </div>
    </form>
  );
}

export function TokenDialog() {
  const t = useT();
  const open = useTokenDialogOpen();
  const close = () => setTokenDialog(false);
  return (
    <Dialog open={open} title={t("token.title")} onClose={close}>
      <TokenForm onClose={close} />
    </Dialog>
  );
}

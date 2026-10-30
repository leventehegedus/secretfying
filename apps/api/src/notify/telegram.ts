import type { Message } from "./digest.js";

export interface Notifier {
  readonly name: string;
  send(m: Message): Promise<void>;
}

export function createTelegram(
  token: string,
  chatId: string,
  fetchFn: typeof fetch = fetch,
): Notifier {
  return {
    name: "telegram",
    async send(m) {
      let res: Response;
      try {
        res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${m.subject}\n\n${m.text}`,
            disable_web_page_preview: true,
          }),
        });
      } catch {
        // The original error may embed the URL, and the token is in the path.
        throw new Error("telegram request failed");
      }
      if (!res.ok) throw new Error(`telegram HTTP ${res.status}`);
    },
  };
}

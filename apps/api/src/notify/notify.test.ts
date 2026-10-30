import { describe, expect, it, vi } from "vitest";
import { createNotifiers } from "./index.js";

const TOKEN = "123456:SECRET-token";
const msg = { subject: "S", text: "T" };

describe("telegram notifier", () => {
  it("posts plain JSON to the bot endpoint", async () => {
    const fetchFn = vi.fn(
      async (_u: string | URL | Request, _i?: RequestInit) => new Response("{}"),
    );
    const [n] = createNotifiers(
      { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "42" },
      () => {},
      fetchFn,
    );
    await n?.send(msg);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "42",
      text: "S\n\nT",
      disable_web_page_preview: true,
    });
  });

  it("HTTP 500 and network errors throw without the token", async () => {
    for (const fetchFn of [
      async () => new Response("no", { status: 500 }),
      async () => {
        throw new Error(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`);
      },
    ]) {
      const [n] = createNotifiers(
        { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "42" },
        () => {},
        fetchFn,
      );
      const err = await n?.send(msg).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect(String(err)).not.toContain("SECRET");
    }
  });

  it("unconfigured is a no-op with one log line", () => {
    const log = vi.fn();
    expect(createNotifiers({}, log)).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });
});

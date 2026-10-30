import type { Config } from "../config.js";
import { createTelegram } from "./telegram.js";
import type { Notifier } from "./telegram.js";

export type { Notifier } from "./telegram.js";
export { buildDigest } from "./digest.js";

export function createNotifiers(
  cfg: Pick<Config, "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID">,
  log: (msg: string) => void,
  fetchFn?: typeof fetch,
): Notifier[] {
  if (cfg.TELEGRAM_BOT_TOKEN && cfg.TELEGRAM_CHAT_ID) {
    return [createTelegram(cfg.TELEGRAM_BOT_TOKEN, cfg.TELEGRAM_CHAT_ID, fetchFn)];
  }
  log("telegram not configured: notifications disabled");
  return [];
}

import type { QuotaRefusalKind } from "../quota/guard.js";

export class QuotaError extends Error {
  constructor(
    readonly kind: QuotaRefusalKind,
    message: string,
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

type Opts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  reserve: () => Promise<void>;
  fetchFn?: typeof fetch;
  redact?: string[];
  sleep?: (ms: number) => Promise<void>;
};

const BACKOFF_MS = 1000;

function redactUrl(url: string, keys: string[]): string {
  const u = new URL(url);
  for (const k of keys) if (u.searchParams.has(k)) u.searchParams.set(k, "***");
  return u.toString().replaceAll("%2A%2A%2A", "***");
}

export async function getJson(url: string, opts: Opts): Promise<unknown> {
  const { timeoutMs = 10000, retries = 1, fetchFn = fetch, redact = [] } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const safe = redactUrl(url, redact);
  let failure = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS);
    await opts.reserve(); // throws QuotaError to stop
    let retryable = true;
    try {
      const init: RequestInit = { signal: AbortSignal.timeout(timeoutMs) };
      if (opts.headers) init.headers = opts.headers;
      const res = await fetchFn(url, init);
      if (res.ok) return await res.json();
      retryable = res.status === 429 || res.status >= 500;
      failure = `HTTP ${res.status}`;
    } catch (e) {
      failure = e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network error";
    }
    if (!retryable) break;
  }
  throw new Error(`${failure} for GET ${safe}`);
}

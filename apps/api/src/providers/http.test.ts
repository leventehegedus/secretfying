import { describe, expect, it, vi } from "vitest";
import { getJson, QuotaError } from "./http.js";

const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const url = "https://api.example.com/x?api_key=SECRET&q=1";
const base = () => ({ reserve: vi.fn(async () => {}), sleep: async () => {}, redact: ["api_key"] });

describe("getJson", () => {
  it("retries a 500 once and reserves before each attempt", async () => {
    const o = base();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(200, { a: 1 }));
    expect(await getJson(url, { ...o, fetchFn })).toEqual({ a: 1 });
    expect(o.reserve).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws after two 429s with redacted url and status", async () => {
    const o = base();
    const fetchFn = vi.fn().mockImplementation(async () => res(429));
    const err = await getJson(url, { ...o, fetchFn, headers: { "X-Access-Token": "HDR" } }).catch(
      (e: unknown) => e,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const msg = err instanceof Error ? err.message : "";
    expect(msg).toContain("429");
    expect(msg).toContain("api_key=***");
    expect(msg).not.toContain("SECRET");
    expect(msg).not.toContain("HDR");
  });

  it("does not retry a 400", async () => {
    const o = base();
    const fetchFn = vi.fn().mockResolvedValue(res(400));
    await expect(getJson(url, { ...o, fetchFn })).rejects.toThrow("400");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("timeout error has no token", async () => {
    const o = base();
    const fetchFn = vi.fn(
      (_u: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const err = await getJson(url, { ...o, fetchFn, timeoutMs: 5, retries: 0 }).catch(
      (e: unknown) => e,
    );
    const msg = err instanceof Error ? err.message : "";
    expect(msg).toContain("api_key=***");
    expect(msg).not.toContain("SECRET");
  });

  it("stops before fetch when reserve throws QuotaError", async () => {
    const fetchFn = vi.fn();
    const reserve = vi.fn().mockRejectedValue(new QuotaError("quota_exhausted", "cap"));
    await expect(getJson(url, { reserve, fetchFn, sleep: async () => {} })).rejects.toBeInstanceOf(
      QuotaError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

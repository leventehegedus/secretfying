import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api, ApiError } from "./api";
import { setToken } from "./auth";

const reply = (status: number, body?: unknown) =>
  vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );

afterEach(() => vi.unstubAllGlobals());

const headersOf = (f: ReturnType<typeof reply>): Headers =>
  new Headers(f.mock.calls[0]?.[1].headers);

describe("api", () => {
  it("sends no Authorization header on GET", async () => {
    setToken("secret");
    const f = reply(200, { a: 1 });
    vi.stubGlobal("fetch", f);
    await api("/x", z.object({ a: z.number() }));
    expect(headersOf(f).has("Authorization")).toBe(false);
  });

  it("sends the bearer token and JSON body on writes", async () => {
    setToken("secret");
    const f = reply(200, {});
    vi.stubGlobal("fetch", f);
    await api("/x", z.object({}), { method: "POST", body: { b: 2 } });
    const headers = headersOf(f);
    expect(headers.get("Authorization")).toBe("Bearer secret");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("throws ApiError with status and zod issues", async () => {
    const issues = [{ path: "origin", message: "unknown IATA code" }];
    vi.stubGlobal("fetch", reply(400, { error: "invalid_request", issues }));
    const err = await api("/x", z.object({})).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: "invalid_request", issues });
  });

  it("returns undefined body for 204", async () => {
    vi.stubGlobal("fetch", reply(204));
    await expect(api("/x", z.undefined(), { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("rejects a response that fails the schema", async () => {
    vi.stubGlobal("fetch", reply(200, { a: "no" }));
    await expect(api("/x", z.object({ a: z.number() }))).rejects.toBeInstanceOf(z.ZodError);
  });
});

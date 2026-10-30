import { describe, expect, it } from "vitest";
import { testApp } from "../test/app.js";

const body = { destination: "LIS", maxPrice: 120 };

describe("watches", () => {
  it("creates, lists, updates and deletes", async () => {
    const { app } = await testApp();
    const created = await app.inject({ method: "POST", url: "/api/watches", payload: body });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    expect(created.json()).toMatchObject({ origin: "BUD", destination: "LIS", tripType: "return" });

    const list = await app.inject({ method: "GET", url: "/api/watches" });
    expect(list.json()).toHaveLength(1);

    const put = await app.inject({
      method: "PUT",
      url: `/api/watches/${id}`,
      payload: { destination: "BCN", active: false },
    });
    expect(put.json()).toMatchObject({ id, destination: "BCN", active: false });

    const del = await app.inject({ method: "DELETE", url: `/api/watches/${id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/watches" })).json()).toEqual([]);
  });

  it("accepts ANYWHERE and city codes", async () => {
    const { app } = await testApp();
    for (const destination of ["ANYWHERE", "LON"]) {
      const r = await app.inject({ method: "POST", url: "/api/watches", payload: { destination } });
      expect(r.statusCode).toBe(201);
    }
  });

  it.each([
    ["unknown IATA", { destination: "ZZZ" }],
    ["unknown origin", { destination: "LIS", origin: "QQQ" }],
    ["bad shape", { destination: "lis" }],
    ["bad stay", { destination: "LIS", minStay: 9, maxStay: 3 }],
  ])("400 on %s", async (_n, payload) => {
    const { app } = await testApp();
    const r = await app.inject({ method: "POST", url: "/api/watches", payload });
    expect(r.statusCode).toBe(400);
    expect(r.json().issues.length).toBeGreaterThan(0);
  });

  it("404 for a missing watch, 400 for a bad id", async () => {
    const { app } = await testApp();
    expect(
      (await app.inject({ method: "PUT", url: "/api/watches/9", payload: body })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/watches/9" })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/watches/x" })).statusCode).toBe(400);
  });
});

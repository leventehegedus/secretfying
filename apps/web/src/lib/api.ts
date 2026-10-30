import { z } from "zod";
import { getToken } from "./auth";

export type Issue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
  ) {
    super(message);
  }

  /** 401 wrong token, 503 server has no token configured. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 503;
  }
}

const ErrorBody = z.object({
  error: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown };

export async function api<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = "GET", body }: Options = {},
): Promise<z.output<S>> {
  const headers = new Headers();
  if (method !== "GET") {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const parsed = ErrorBody.safeParse(await res.json().catch(() => null));
    throw new ApiError(
      res.status,
      parsed.success ? parsed.data.error : res.statusText,
      parsed.success ? parsed.data.issues : [],
    );
  }
  return schema.parse(res.status === 204 ? undefined : await res.json());
}

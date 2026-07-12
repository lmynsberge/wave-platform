/** Black-box HTTP client with a cookie jar (SPEC-QA-001 R1: no source imports). */
export const SERVER = () => process.env.IT_SERVER_URL ?? "http://127.0.0.1:8180";
export const CORE = () => process.env.IT_CORE_URL ?? "http://127.0.0.1:8181";

export interface Client {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  json: <T = unknown>(path: string, init?: RequestInit) => Promise<{ status: number; body: T }>;
}

export function client(base = SERVER()): Client {
  let cookie = "";
  const doFetch = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(init.headers ?? {}),
      },
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0]!;
    return res;
  };
  return {
    fetch: doFetch,
    json: async <T>(path: string, init: RequestInit = {}) => {
      const res = await doFetch(path, init);
      return { status: res.status, body: (await res.json().catch(() => null)) as T };
    },
  };
}

export const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
export const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });

let seq = 0;
export function uniq(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${++seq}`;
}

export async function signupUser(name: string) {
  const c = client();
  const email = `${uniq(name)}@it.test`;
  const { status, body } = await c.json<{ user: { id: string } }>(
    "/api/auth/signup",
    post({ email, password: "password123", name }),
  );
  if (status !== 201) throw new Error(`signup failed: ${status}`);
  return { c, id: body.user.id, email };
}

/** Seed an attribute directly in core (test setup only; core API is server-internal in prod). */
export async function seedAttribute(key: string, kind: "objective" | "subjective") {
  await fetch(`${CORE()}/v1/attributes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, name: key, kind }),
  });
}

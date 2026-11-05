const base = import.meta.env.VITE_API_URL || "/api";
let accessToken: string | null = null;
let refreshing: Promise<unknown> | null = null;
export const setAccessToken = (value: string | null) => {
  accessToken = value;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function parse(response: Response) {
  if (response.status === 204) return null;
  const body = await response
    .json()
    .catch(() => ({ detail: "Unable to connect to the server." }));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail
          .map(
            (d: { loc: string[]; msg: string }) =>
              `${d.loc.slice(1).join(" ")}: ${d.msg}`,
          )
          .join("; ")
      : body.detail;
    throw new ApiError(response.status, detail || "Request failed.");
  }
  return body;
}
export async function restoreSession() {
  if (!refreshing) {
    refreshing = fetch(`${base}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(parse)
      .then((data) => {
        accessToken = data.access_token;
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing as Promise<{
    access_token: string;
    user: import("./types").User;
  }>;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  }).catch(() => {
    throw new Error(
      "Cannot reach the server. Check your connection and try again.",
    );
  });
  const protectedRequest = ![
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
  ].includes(path);
  if (response.status === 401 && retry && protectedRequest) {
    try {
      await restoreSession();
    } catch {
      accessToken = null;
      window.dispatchEvent(new Event("session-expired"));
      throw new ApiError(
        401,
        "Your session has expired. Please sign in again.",
      );
    }
    return api(path, options, false);
  }
  if (response.status === 401 && protectedRequest) {
    accessToken = null;
    window.dispatchEvent(new Event("session-expired"));
  }
  return parse(response);
}
export const send = <T>(path: string, method: string, data?: unknown) =>
  api<T>(path, {
    method,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
export function invalidate() {
  window.dispatchEvent(new Event("crm-updated"));
}

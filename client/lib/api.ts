let dynamicBase: string | null = null;
let detectionPromise: Promise<string> | null = null;

function sanitizeBase(value: string) {
  return value.replace(/\/$/, "");
}

function readQueryApiBase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get("api");
    return v ? sanitizeBase(v) : null;
  } catch {
    return null;
  }
}

function readStoredApiBase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem("apiBase");
    return v ? sanitizeBase(v) : null;
  } catch {
    return null;
  }
}

async function detectApiBase(): Promise<string> {
  if (typeof window === "undefined") return "";
  const tryPing = async (base: string) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`${sanitizeBase(base)}/api/ping`, {
        headers: { "X-Requested-With": "fetch" },
        credentials: "include",
        signal: controller.signal,
      });
      if (res.ok) return true;
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(id);
    }
  };

  // 1) Same origin
  if (await tryPing("")) return "";
  // 2) Netlify Functions
  if (await tryPing("/.netlify/functions/api"))
    return "/.netlify/functions/api";
  // 3) No detection, fallback to same-origin
  return "";
}

async function ensureApiBaseResolved() {
  if (dynamicBase !== null) return dynamicBase;
  if (!detectionPromise)
    detectionPromise = detectApiBase().then((b) => (dynamicBase = b));
  return detectionPromise;
}

export async function resolveApiBase(): Promise<string> {
  return ensureApiBaseResolved();
}

export function getApiBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as
    | string
    | undefined;
  if (envBase) return sanitizeBase(envBase);
  // @ts-ignore
  const runtime =
    typeof window !== "undefined" ? (window as any).__API_BASE__ : undefined;
  if (runtime) return sanitizeBase(String(runtime));
  const fromQuery = readQueryApiBase();
  if (fromQuery) {
    dynamicBase = fromQuery;
    try {
      localStorage.setItem("apiBase", dynamicBase);
    } catch {}
    return dynamicBase;
  }
  const stored = readStoredApiBase();
  if (stored) {
    dynamicBase = stored;
    return dynamicBase;
  }
  if (dynamicBase !== null) return dynamicBase;
  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = "/" + path;
  return `${base}${path}`;
}

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const url = apiUrl(path);
    const requestInit = {
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "fetch",
        ...(opts?.headers || {}),
      },
      credentials: "include",
      ...opts,
    };

    // Create a timeout promise (30 seconds for API requests)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error("Request timeout - server took too long to respond"),
          ),
        30000,
      );
    });

    try {
      // Race between fetch and timeout
      return await Promise.race([fetch(url, requestInit), timeoutPromise]);
    } catch (err) {
      // Log network errors for debugging
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[API] Network error for ${opts?.method || "GET"} ${path}: ${errorMsg}`,
      );
      throw err;
    }
  };

  let res: Response | null = null;
  try {
    res = await doFetch();
  } catch (e) {
    try {
      await ensureApiBaseResolved();
      res = await doFetch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[API] Failed to reach server at path ${path}: ${errorMsg}`);
      throw new Error(
        "Unable to reach the server. Please check your connection and try again.",
      );
    }
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let data: any = null;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
        if (data && typeof data.message === "string") message = data.message;
        else if (data && typeof data.error === "string") message = data.error;
      } else {
        const text = await res.text();
        if (text) message = text;
      }
    } catch {}

    // Log server errors for debugging
    console.error(`[API] Server error ${res.status} for ${path}: ${message}`);
    if (data) {
      console.debug(`[API] Response data:`, data);
    }

    if (res.status === 400) {
      if (data?.code === "MISSING_CREDENTIALS") {
        message = "Please enter both username and password.";
      } else {
        message =
          data?.message ||
          "An unexpected error occurred. Please try again later.";
      }
    } else if (res.status === 401) {
      const isLogin = path.startsWith("/api/auth/login");
      if (isLogin) {
        if (data?.code === "INVALID_CREDENTIALS" || !data?.code) {
          message = "Invalid username or password.";
        } else if (data?.code === "NO_SESSION") {
          message = "Access denied. Please login to continue.";
        } else {
          message = "Your session has expired. Please sign in again.";
        }
      } else {
        if (data?.code === "NO_SESSION") {
          message = "Access denied. Please login to continue.";
        } else {
          message = "Your session has expired. Please sign in again.";
        }
      }
    } else if (res.status === 403) {
      message =
        data?.message ||
        "Access denied. You do not have permission to perform this action.";
    } else if (res.status >= 500) {
      message =
        data?.message ||
        "An unexpected error occurred. Please try again later.";
    }

    throw new Error(message);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[API] Failed to parse JSON response for ${path}:`, err);
    throw new Error("Invalid server response. Please try again later.");
  }
}

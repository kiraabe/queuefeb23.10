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
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${sanitizeBase(base)}/api/ping`, {
        headers: { "X-Requested-With": "fetch" },
        credentials: "include",
        signal: controller.signal,
        method: "GET",
      });
      clearTimeout(timeoutId);
      // Accept any successful response (not just 200)
      return res.ok || res.status === 200 || res.status === 401;
    } catch (err) {
      clearTimeout(timeoutId);
      // Timeout or network error - return false
      if (process.env.NODE_ENV === "development") {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.debug(`[API] Ping failed for base "${base}": ${errMsg}`);
      }
      return false;
    }
  };

  // 1) Same origin (most common case)
  if (await tryPing("")) return "";

  // 2) Netlify Functions
  if (await tryPing("/.netlify/functions/api"))
    return "/.netlify/functions/api";

  // 3) No detection found, default to same-origin (usually works)
  // This is the safest fallback for development
  if (process.env.NODE_ENV === "development") {
    console.debug("[API] API base detection: defaulting to same-origin");
  }
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

export async function apiCall<T = any>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const opts: RequestInit = {
    method,
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  return apiFetch<T>(path, opts);
}

export async function apiFetch<T>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const url = apiUrl(path);
    const requestInit: RequestInit = {
      credentials: "include",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "fetch",
        ...(opts?.headers || {}),
      },
    };

    // Create an AbortController for proper timeout handling
    // Increased timeout from 30s to 60s for slow endpoints
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      // Check if this was a timeout abort
      const isTimeoutAbort =
        err instanceof Error &&
        err.name === "AbortError" &&
        controller.signal.aborted;

      // Log network errors for debugging (skip expected timeouts)
      if (!isTimeoutAbort) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[API] Network error for ${opts?.method || "GET"} ${path}: ${errorMsg}`,
        );
      }
      throw err;
    }
  };

  let res: Response | null = null;
  try {
    res = await doFetch();
  } catch (e) {
    // Check if this is a timeout error
    const isTimeoutError =
      e instanceof Error &&
      (e.name === "AbortError" || e.message.includes("timeout"));
    const errorMsg = e instanceof Error ? e.message : String(e);

    // Check if this is a network error (fetch failed entirely)
    const isNetworkError =
      e instanceof TypeError &&
      (errorMsg.includes("Failed to fetch") ||
       errorMsg.includes("NetworkError") ||
       errorMsg.includes("network"));

    // Only retry with API base resolution if first attempt failed
    // and we haven't already resolved the API base
    if (dynamicBase === null && !isTimeoutError && !isNetworkError) {
      try {
        const detectedBase = await ensureApiBaseResolved();
        if (detectedBase !== getApiBase()) {
          // API base was successfully detected and changed, retry
          res = await doFetch();
        } else {
          // API base didn't change, no point retrying
          throw e;
        }
      } catch (retryErr) {
        const retryErrorMsg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error(
          `[API] Failed to reach server at path ${path}: ${retryErrorMsg}`,
        );
        throw new Error(
          "Unable to reach the server. Please check your connection and try again.",
        );
      }
    } else {
      // Already tried API base detection or timeout/network error, just throw
      console.error(
        `[API] Failed to reach server at path ${path}: ${errorMsg}`,
      );
      if (isTimeoutError) {
        throw new Error(
          "Request timed out. The server is taking too long to respond. Please try again.",
        );
      } else if (isNetworkError) {
        throw new Error(
          "Network error. Please check your internet connection and try again.",
        );
      } else {
        throw new Error(
          "Unable to reach the server. Please check your connection and try again.",
        );
      }
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

    // Only log 404 and 5xx errors for non-ping endpoints
    const isPingPath = path === "/api/ping" || path === "/api/session/ping" || path === "/api/auth/heartbeat";
    const isLoginPath = path.includes("/auth/login") || path.includes("/auth/signin");
    if (res.status !== 404 || !isPingPath) {
      console.error(`[API] Server error ${res.status} for ${path}: ${message}`);
      if (data && res.status >= 400 && res.status < 500) {
        console.debug(`[API] Response data:`, data);
      }
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
      if (isLoginPath) {
        if (data?.code === "INVALID_CREDENTIALS" || !data?.code) {
          message = "Invalid username or password.";
        } else if (data?.code === "NO_SESSION") {
          message = "Access denied. Please login to continue.";
        } else if (data?.code === "MAX_SESSIONS_REACHED") {
          message = data.message;
        } else {
          message = "Your session has expired. Please sign in again.";
        }
      } else {
        if (data?.code === "NO_SESSION") {
          message = "Access denied. Please login to continue.";
        } else {
          message = "Your session has expired. Please sign in again.";
        }
        // Auto-redirect to login for non-login endpoints with 401
        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.location.href = "/login";
          }, 1000);
        }
      }
    } else if (res.status === 403) {
      message =
        data?.message ||
        "Access denied. You do not have permission to perform this action.";
    } else if (res.status === 404) {
      // For 404s on auth endpoints, it might be a server routing issue
      if (isLoginPath) {
        message = "Login service is unavailable. Please try again.";
      }
    } else if (res.status >= 500) {
      message =
        data?.message ||
        "An unexpected error occurred. Please try again later.";
    }

    throw new Error(message);
  }

  try {
    // 204 No Content should not be parsed as JSON
    if (res.status === 204) return {} as T;

    // Check if there's actually a body before parsing
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return {} as T;
  } catch (err) {
    // If it's a network error during JSON parsing (like broken stream), log more info
    if (err instanceof TypeError && err.message.includes("fetch")) {
      console.warn(`[API] Stream interrupted during JSON parse for ${path}:`, err);
    } else {
      console.error(`[API] Failed to parse JSON response for ${path}:`, err);
    }
    throw new Error("Invalid server response. Please try again later.");
  }
}

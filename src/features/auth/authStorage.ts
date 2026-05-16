import type { User } from "./auth.api";
import { getApiBaseUrl } from "@/lib/apiUrl";
import { markPerf, measurePerf } from "@/lib/perf";

export const AUTH_SESSION_EVENT = "vasanthtrends:auth-session";
const CSRF_COOKIE_NAME = "csrfToken";
let logoutRequest: Promise<void> | null = null;
let logoutCompleted = false;
let authSessionEpoch = 0;

const canUseBrowser = () => typeof window !== "undefined";

type LogoutDebugPayload = {
  source?: string;
  hasCsrfToken?: boolean;
  hasInflightRequest?: boolean;
  alreadyCompleted?: boolean;
};

const debugLogout = (event: string, payload: LogoutDebugPayload = {}) => {
  if (!canUseBrowser() || process.env.NODE_ENV === "production") return;

  console.info("auth_logout", {
    event,
    ...payload,
  });
};

const notifyAuthSessionChanged = () => {
  if (!canUseBrowser()) return;

  window.setTimeout(() => {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }, 0);
};

export const getCookieValue = (name: string): string | null => {
  if (!canUseBrowser()) return null;

  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")[1];

  return value ? decodeURIComponent(value) : null;
};

export const getCsrfToken = (): string | null => getCookieValue(CSRF_COOKIE_NAME);

export const clearLocalAuthSession = () => {
  // Access and refresh tokens are HTTP-only cookies owned by the backend.
  // The client intentionally clears only in-memory state, reducing XSS impact.
  authSessionEpoch += 1;
  notifyAuthSessionChanged();
};

export const getStoredAccessToken = (): string | null => null;
export const getStoredUser = (): User | null => null;

export const persistAuthSession = (_accessToken: string, _user: User) => {
  // Tokens are delivered as HTTP-only cookies. Redux receives user data from the
  // caller; no browser persistence is needed here.
  logoutCompleted = false;
  authSessionEpoch += 1;
};

export const getAuthSessionEpoch = (): number => authSessionEpoch;
export const hasCompletedLogout = (): boolean => logoutCompleted;

export const clearAuthSession = async (source = "unknown"): Promise<void> => {
  if (logoutRequest) {
    debugLogout("duplicate_inflight_ignored", {
      source,
      hasInflightRequest: true,
    });
    return logoutRequest;
  }

  const apiUrl = getApiBaseUrl();
  const csrfToken = getCsrfToken();

  if (logoutCompleted && !csrfToken) {
    debugLogout("duplicate_after_completion_ignored", {
      source,
      alreadyCompleted: true,
      hasCsrfToken: false,
    });
    clearLocalAuthSession();
    return;
  }

  debugLogout("request_started", {
    source,
    hasCsrfToken: Boolean(csrfToken),
  });
  markPerf("logout:network-start", {
    source,
    hasCsrfToken: Boolean(csrfToken),
  });

  clearLocalAuthSession();

  if (!apiUrl) {
    logoutCompleted = true;
    debugLogout("request_skipped_missing_api_url", { source });
    return;
  }

  // Logout is intentionally idempotent on the client: one browser action can
  // trigger several UI listeners, but only one CSRF-protected cookie-clearing
  // request should ever be in flight.
  logoutRequest = fetch(`${apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    })
      .then((response) => {
        markPerf("logout:network-end", { source, status: response.status });
        measurePerf(
          "logout:network",
          "logout:network-start",
          "logout:network-end",
          { source, status: response.status }
        );
        debugLogout("response_received", {
          source,
          hasCsrfToken: Boolean(csrfToken),
        });

        if (!response.ok && response.status !== 401 && response.status !== 403) {
          throw new Error(`Logout failed with status ${response.status}`);
        }

        // Logout is user-intent cleanup. Once the browser has asked the server
        // to clear cookies, later unauthorized/CSRF responses from duplicate UI
        // triggers should not resurrect auth state.
        logoutCompleted = true;
      })
      .catch((error: unknown) => {
        logoutCompleted = true;
        debugLogout("request_failed_treated_as_local_logout", {
          source,
          hasCsrfToken: Boolean(csrfToken),
        });

        if (process.env.NODE_ENV !== "production") {
          console.info("auth_logout", {
            event: "failure_detail",
            source,
            error: error instanceof Error ? error.message : "Unknown logout error",
          });
        }
      })
      .then(() => undefined)
      .finally(() => {
        logoutRequest = null;
      });

  return logoutRequest;
};

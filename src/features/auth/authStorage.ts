import type { User } from "./auth.api";
import { getApiBaseUrl } from "@/lib/apiUrl";
import { markPerf, measurePerf } from "@/lib/perf";

export const AUTH_SESSION_EVENT = "vasanthtrends:auth-session";
export const AUTH_SESSION_STORAGE_KEY = "vasanthtrends:auth-session-event";
const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_SESSION_STORAGE_KEY = "vasanthtrends:csrf-token";
const AUTH_BROADCAST_CHANNEL = "vasanthtrends:auth";
let logoutRequest: Promise<void> | null = null;
let logoutCompleted = false;
let authSessionEpoch = 0;
let lastAuthSuccessAt = 0;
const postLoginRefreshDelayMs = 900;
const postLoginRefreshSkipMs = 2_000;

export type AuthSessionEventType =
  | "session_updated"
  | "logout"
  | "refresh_failed"
  | "stale_tab_logout";

export interface AuthSessionEventPayload {
  type: AuthSessionEventType;
  epoch: number;
  reason?: string;
  timestamp: number;
}

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

const createAuthSessionEvent = (
  type: AuthSessionEventType,
  reason?: string
): AuthSessionEventPayload => ({
  type,
  epoch: authSessionEpoch,
  reason,
  timestamp: Date.now(),
});

const notifyAuthSessionChanged = (
  type: AuthSessionEventType,
  reason?: string
) => {
  if (!canUseBrowser()) return;

  const event = createAuthSessionEvent(type, reason);

  try {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(event));
  } catch {
    // Some private browsing modes restrict storage. The same-tab event still
    // keeps logout deterministic in the active tab.
  }

  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    channel.postMessage(event);
    channel.close();
  } catch {
    // BroadcastChannel is unavailable in older/private browser modes; storage
    // and same-tab CustomEvent remain the compatibility path.
  }

  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent<AuthSessionEventPayload>(AUTH_SESSION_EVENT, {
        detail: event,
      })
    );
  }, 0);
};

export const parseAuthSessionEvent = (
  raw: string | null
): AuthSessionEventPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSessionEventPayload>;

    if (
      (parsed.type === "session_updated" ||
        parsed.type === "logout" ||
        parsed.type === "refresh_failed" ||
        parsed.type === "stale_tab_logout") &&
      typeof parsed.timestamp === "number"
    ) {
      return {
        type: parsed.type,
        epoch:
          typeof parsed.epoch === "number" ? parsed.epoch : authSessionEpoch,
        reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
        timestamp: parsed.timestamp,
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const createAuthBroadcastChannel = (): BroadcastChannel | null => {
  if (!canUseBrowser()) return null;

  try {
    return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  } catch {
    return null;
  }
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

const getStoredCsrfToken = (): string | null => {
  if (!canUseBrowser()) return null;
  return window.sessionStorage.getItem(CSRF_SESSION_STORAGE_KEY);
};

const setStoredCsrfToken = (csrfToken: string | undefined): void => {
  if (!canUseBrowser() || !csrfToken) return;
  window.sessionStorage.setItem(CSRF_SESSION_STORAGE_KEY, csrfToken);
};

const clearStoredCsrfToken = (): void => {
  if (!canUseBrowser()) return;
  window.sessionStorage.removeItem(CSRF_SESSION_STORAGE_KEY);
};

export const getCsrfToken = (): string | null =>
  getCookieValue(CSRF_COOKIE_NAME) ?? getStoredCsrfToken();

export const clearLocalAuthSession = () => {
  // Access and refresh tokens are HTTP-only cookies owned by the backend.
  // The client intentionally clears only in-memory state, reducing XSS impact.
  clearStoredCsrfToken();
  authSessionEpoch += 1;
  notifyAuthSessionChanged("logout");
};

export const expireLocalAuthSession = (reason = "refresh_failed"): void => {
  clearStoredCsrfToken();
  logoutCompleted = true;
  authSessionEpoch += 1;
  notifyAuthSessionChanged("refresh_failed", reason);
};

export const markStaleTabLoggedOut = (reason = "stale_tab"): void => {
  clearStoredCsrfToken();
  logoutCompleted = true;
  authSessionEpoch += 1;
  notifyAuthSessionChanged("stale_tab_logout", reason);
};

export const getStoredAccessToken = (): string | null => null;
export const getStoredUser = (): User | null => null;

export const persistAuthSession = (
  _accessToken: string,
  _user: User,
  csrfToken?: string
) => {
  // Tokens are delivered as HTTP-only cookies. Redux receives user data from the
  // caller; no browser token persistence is needed here. In cross-origin
  // deployments the csrfToken cookie belongs to the API domain, so the backend
  // also returns the nonce in JSON for this first-party app to echo in headers.
  setStoredCsrfToken(csrfToken);
  logoutCompleted = false;
  lastAuthSuccessAt = Date.now();
  authSessionEpoch += 1;
  notifyAuthSessionChanged("session_updated");
};

export const getAuthSessionEpoch = (): number => authSessionEpoch;
export const hasCompletedLogout = (): boolean => logoutCompleted;
export const getPostLoginRefreshDelayMs = (): number =>
  Math.max(0, postLoginRefreshDelayMs - (Date.now() - lastAuthSuccessAt));
export const shouldSkipRefreshAfterRecentLogin = (): boolean =>
  lastAuthSuccessAt > 0 && Date.now() - lastAuthSuccessAt < postLoginRefreshSkipMs;

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

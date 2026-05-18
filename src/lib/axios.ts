import axios from "axios";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  expireLocalAuthSession,
  expireLocalAuthSessionIfInactive,
  getCsrfToken,
  getAuthSessionEpoch,
  getStoredAccessToken,
  persistAuthSession,
  recordAuthActivity,
  syncFirstPartyAuthSession,
} from "@/features/auth/authStorage";
import type { AuthResponse } from "@/features/auth/auth.api";
import { captureFrontendException, captureFrontendMessage } from "@/lib/observability";

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",   // ✅ explicit — never rely on axios inference
  },
});

let refreshPromise: Promise<AuthResponse> | null = null;
let refreshCircuitOpenUntil = 0;
let consecutiveRefreshFailures = 0;
const refreshCooldownMs = 4_000;
const refreshCircuitBreakerThreshold = 2;
const refreshCircuitBreakerMs = 15_000;

type ApiErrorBody = {
  message?: string;
  code?: string | number | null;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isConfirmedInvalidRefreshError = (error: unknown): boolean => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return false;

  const message = String(error.response?.data?.message ?? "").toLowerCase();

  return (
    error.response?.status === 401 &&
    (message.includes("suspicious session") ||
      message.includes("refresh token expired or invalid"))
  );
};

export const isMissingRefreshCookieError = (error: unknown): boolean => {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return false;

  return (
    error.response?.status === 401 &&
    String(error.response?.data?.message ?? "").toLowerCase().includes("no refresh token")
  );
};

const shouldRetryRefreshError = (error: unknown): boolean => {
  if (isConfirmedInvalidRefreshError(error)) return false;

  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  const code = error.response?.data?.code;

  if (status === 409 && code === "REFRESH_ROTATION_IN_PROGRESS") {
    return true;
  }

  return error.code === "ERR_NETWORK" || error.code === "ECONNABORTED";
};

const postRefresh = async (apiUrl: string): Promise<AuthResponse> => {
  const response = await axios.post<AuthResponse>(
    `${apiUrl}/v1/auth/refresh`,
    {},
    { withCredentials: true }
  );

  return response.data;
};

export const refreshAuthSession = async () => {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  if (Date.now() < refreshCircuitOpenUntil) {
    captureFrontendMessage("refresh_retry_loop_prevented", {
      circuitOpenUntil: refreshCircuitOpenUntil,
    });
    expireLocalAuthSessionIfInactive("inactive_refresh_circuit_open");
    throw new Error("Refresh temporarily disabled after repeated failures");
  }

  if (refreshPromise && process.env.NODE_ENV !== "production") {
    console.info("auth_refresh", { event: "deduped_inflight" });
  }

  const startedEpoch = getAuthSessionEpoch();

  refreshPromise ??= postRefresh(apiUrl)
    .catch(async (error: unknown) => {
      if (!shouldRetryRefreshError(error)) {
        throw error;
      }

      if (process.env.NODE_ENV !== "production") {
        console.info("auth_refresh", {
          event: "retry_scheduled",
          status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
        });
      }
      captureFrontendMessage("auth_refresh_retry_scheduled", {
        status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
      });

      await sleep(700);
      return postRefresh(apiUrl);
    })
    .then(async (session) => {
      consecutiveRefreshFailures = 0;
      refreshCircuitOpenUntil = 0;

      if (getAuthSessionEpoch() !== startedEpoch) {
        captureFrontendMessage("auth_refresh_stale_result_ignored", {
          startedEpoch,
          currentEpoch: getAuthSessionEpoch(),
        });
        throw new Error("Stale refresh result ignored");
      }

      if (process.env.NODE_ENV !== "production") {
        console.info("auth_refresh", {
          event: "success",
          hasCsrfToken: Boolean(session.csrfToken),
        });
      }
      captureFrontendMessage("auth_refresh_success", {
        hasCsrfToken: Boolean(session.csrfToken),
      });

      await syncFirstPartyAuthSession(session.accessToken).catch((error) => {
        captureFrontendException(error, {
          area: "auth_session_bridge",
        });
      });

      return session;
    })
    .catch((error: unknown) => {
      const missingRefreshCookie = isMissingRefreshCookieError(error);

      if (!missingRefreshCookie) {
        consecutiveRefreshFailures += 1;
      }

      if (!missingRefreshCookie) {
        if (consecutiveRefreshFailures >= refreshCircuitBreakerThreshold) {
          refreshCircuitOpenUntil = Date.now() + refreshCircuitBreakerMs;
          captureFrontendMessage("refresh_circuit_opened", {
            failures: consecutiveRefreshFailures,
            cooldownMs: refreshCircuitBreakerMs,
          });
        } else {
          refreshCircuitOpenUntil = Date.now() + refreshCooldownMs;
        }
      }

      if (process.env.NODE_ENV !== "production") {
        console.info("auth_refresh", {
          event: "failed",
          status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
        });
      }
      captureFrontendException(error, {
        area: "auth_refresh",
        status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
      });

      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      const code = axios.isAxiosError<ApiErrorBody>(error)
        ? error.response?.data?.code
        : undefined;

      if (
        code === "SESSION_INACTIVE_TIMEOUT" ||
        status === 401 ||
        status === 403 ||
        code === "REFRESH_TOKEN_STALE" ||
        code === "REFRESH_REUSE_DETECTED" ||
        (!missingRefreshCookie &&
          consecutiveRefreshFailures >= refreshCircuitBreakerThreshold)
      ) {
        const reason = String(code ?? status ?? "refresh_failed");
        if (code === "SESSION_INACTIVE_TIMEOUT") {
          expireLocalAuthSession(reason);
        } else {
          expireLocalAuthSessionIfInactive(reason);
        }
      }

      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken();
  const accessToken = getStoredAccessToken();

  recordAuthActivity();

  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const status =
      axios.isAxiosError(error) ? error.response?.status : undefined;
    const originalRequest = axios.isAxiosError(error)
      ? error.config
      : undefined;

    const requestUrl = originalRequest?.url ?? "";
    const isAuthRequest =
      requestUrl.includes("/v1/auth/login") ||
      requestUrl.includes("/v1/auth/register") ||
      requestUrl.includes("/v1/auth/refresh") ||
      requestUrl.includes("/v1/auth/logout");
    let refreshFailedAuth = false;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest.headers?.["x-auth-retry"] &&
      !isAuthRequest
    ) {
      try {
        const refreshedSession = await refreshAuthSession();

        persistAuthSession(
          refreshedSession.accessToken,
          refreshedSession.user,
          refreshedSession.csrfToken
        );

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers["x-auth-retry"] = "1";

        return api(originalRequest);
      } catch (refreshError) {
        const refreshStatus = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;

        if (refreshStatus === 401 || refreshStatus === 403) {
          refreshFailedAuth = true;
          expireLocalAuthSessionIfInactive(
            `request_retry_refresh_${refreshStatus}`
          );
          if (process.env.NODE_ENV !== "production") {
            console.info("auth_refresh", {
              event: "request_retry_failed_unauthenticated",
              status: refreshStatus,
            });
          }
        } else {
          captureFrontendMessage("refresh_retry_loop_prevented", {
            status: refreshStatus ?? null,
          });
        }
      }
    }

    if (status === 401 && !isAuthRequest && !refreshFailedAuth) {
      // Navigation is owned by route guards so protected pages can wait through
      // mobile cookie propagation and unknown auth states without flapping.
    }

    return Promise.reject(error);
  }
);

export default api;

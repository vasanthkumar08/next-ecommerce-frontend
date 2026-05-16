import axios from "axios";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  getCsrfToken,
  persistAuthSession,
} from "@/features/auth/authStorage";
import type { AuthResponse } from "@/features/auth/auth.api";

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",   // ✅ explicit — never rely on axios inference
  },
});

let refreshPromise: Promise<AuthResponse> | null = null;

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

const shouldRetryRefreshError = (error: unknown): boolean => {
  if (isConfirmedInvalidRefreshError(error)) return false;

  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  const code = error.response?.data?.code;

  if (status === 409 && code === "REFRESH_ROTATION_IN_PROGRESS") {
    return true;
  }

  return (
    status === 401 ||
    status === 403 ||
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED"
  );
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

  if (refreshPromise && process.env.NODE_ENV !== "production") {
    console.info("auth_refresh", { event: "deduped_inflight" });
  }

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

      await sleep(700);
      return postRefresh(apiUrl);
    })
    .then((session) => {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_refresh", {
          event: "success",
          hasCsrfToken: Boolean(session.csrfToken),
        });
      }

      return session;
    })
    .catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_refresh", {
          event: "failed",
          status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
        });
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

  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
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
          // Refresh failure means the current request is unauthenticated. It is
          // not a logout event; AuthHydrator owns final auth-state resolution.
          if (process.env.NODE_ENV !== "production") {
            console.info("auth_refresh", {
              event: "request_retry_failed_unauthenticated",
              status: refreshStatus,
            });
          }
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

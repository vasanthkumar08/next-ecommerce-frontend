"use client";

import axios from "axios";
import { useEffect } from "react";
import { hydrateAuth, markAuthUnknown } from "@/features/auth/authSlice";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  isConfirmedInvalidRefreshError,
  refreshAuthSession,
} from "@/lib/axios";
import {
  AUTH_SESSION_EVENT,
  AUTH_SESSION_STORAGE_KEY,
  createAuthBroadcastChannel,
  getAuthSessionEpoch,
  getPostLoginRefreshDelayMs,
  getStoredAccessToken,
  getStoredUser,
  hasCompletedLogout,
  parseAuthSessionEvent,
  persistAuthSession,
  shouldSkipRefreshAfterRecentLogin,
  type AuthSessionEventPayload,
} from "@/features/auth/authStorage";
import { useAppDispatch } from "@/store/hooks";
import { markPerf, measurePerf } from "@/lib/perf";
import type { AuthResponse } from "@/features/auth/auth.api";

let appLoadRefreshPromise: Promise<AuthResponse> | null = null;

interface MeResponse {
  success: boolean;
  data?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    role?: "admin" | "user" | "manager";
  };
}

const getAppLoadRefreshPromise = (): Promise<AuthResponse> => {
  appLoadRefreshPromise ??= refreshAuthSession().finally(() => {
    appLoadRefreshPromise = null;
  });
  return appLoadRefreshPromise;
};

const hydrateFromStoredAccessToken = async (
  apiUrl: string
): Promise<AuthResponse | null> => {
  const accessToken = getStoredAccessToken();

  if (!accessToken) return null;

  const response = await axios.get<MeResponse>(`${apiUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    withCredentials: true,
  });

  const user = response.data.data;
  const id = user?._id ?? user?.id;

  if (
    !response.data.success ||
    typeof id !== "string" ||
    typeof user?.name !== "string" ||
    typeof user.email !== "string" ||
    (user.role !== "admin" && user.role !== "manager" && user.role !== "user")
  ) {
    return null;
  }

  return {
    success: true,
    accessToken,
    user: {
      id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export default function AuthHydrator() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    let hydrationInFlight = false;

    const clearFromAuthEvent = (reason = "auth_event") => {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "local_session_cleared",
          reason,
          epoch: getAuthSessionEpoch(),
        });
      }

      dispatch(hydrateAuth({ user: null, accessToken: null }));
    };

    const handleAuthSessionEvent = (
      event: AuthSessionEventPayload | null
    ) => {
      if (!event) return;

      if (
        event.type === "logout" ||
        event.type === "refresh_failed" ||
        event.type === "stale_tab_logout"
      ) {
        clearFromAuthEvent(event.reason ?? event.type);
      }
    };

    const apiUrl = getApiBaseUrl();
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY) {
        handleAuthSessionEvent(parseAuthSessionEvent(event.newValue));
      }
    };
    const onAuthEvent = (event: Event) => {
      handleAuthSessionEvent(
        event instanceof CustomEvent ? event.detail ?? null : null
      );
    };
    const authChannel = createAuthBroadcastChannel();
    const onBroadcastMessage = (event: MessageEvent<AuthSessionEventPayload>) => {
      handleAuthSessionEvent(event.data);
    };

    window.addEventListener(AUTH_SESSION_EVENT, onAuthEvent);
    window.addEventListener("storage", onStorage);
    authChannel?.addEventListener("message", onBroadcastMessage);

    if (!apiUrl) {
      clearFromAuthEvent("missing_api_url");
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, onAuthEvent);
        window.removeEventListener("storage", onStorage);
        authChannel?.removeEventListener("message", onBroadcastMessage);
        authChannel?.close();
      };
    }

    if (hasCompletedLogout()) {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "refresh_skipped_after_logout",
          epoch: getAuthSessionEpoch(),
        });
      }

      clearFromAuthEvent("completed_logout");
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, onAuthEvent);
        window.removeEventListener("storage", onStorage);
        authChannel?.removeEventListener("message", onBroadcastMessage);
        authChannel?.close();
      };
    }

    const runHydration = async () => {
      const storedAccessToken = getStoredAccessToken();
      const storedUser = getStoredUser();

      if (storedAccessToken && storedUser) {
        dispatch(
          hydrateAuth({
            user: storedUser,
            accessToken: storedAccessToken,
          })
        );
      }

      if (shouldSkipRefreshAfterRecentLogin()) {
        if (process.env.NODE_ENV !== "production") {
          console.info("auth_hydration", {
            event: "refresh_skipped_after_recent_login",
            reason: "mobile_cookie_settle_window",
          });
        }

        return;
      }

      const postLoginDelay = getPostLoginRefreshDelayMs();

      if (postLoginDelay > 0) {
        if (process.env.NODE_ENV !== "production") {
          console.info("auth_hydration", {
            event: "post_login_refresh_delayed",
            delayMs: postLoginDelay,
          });
        }

        await new Promise((resolve) => window.setTimeout(resolve, postLoginDelay));
      }

      if (cancelled) return;

      const hydrationEpoch = getAuthSessionEpoch();
      hydrationInFlight = true;
      markPerf("auth-hydration:refresh-start", { epoch: hydrationEpoch });

      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "refresh_started",
          epoch: hydrationEpoch,
        });
      }

      getAppLoadRefreshPromise()
      .then((response) => {
        if (cancelled) return;
        if (hasCompletedLogout() || getAuthSessionEpoch() !== hydrationEpoch) {
          if (process.env.NODE_ENV !== "production") {
            console.info("auth_hydration", {
              event: "stale_refresh_ignored",
              startedEpoch: hydrationEpoch,
              currentEpoch: getAuthSessionEpoch(),
            });
          }
          return;
        }

        persistAuthSession(
          response.accessToken,
          response.user,
          response.csrfToken,
          response.refreshToken
        );
        markPerf("auth-hydration:refresh-end", {
          status: 200,
          userId: response.user.id,
        });
        measurePerf(
          "auth-hydration:refresh",
          "auth-hydration:refresh-start",
          "auth-hydration:refresh-end",
          { status: 200 }
        );
        dispatch(
          hydrateAuth({
            user: response.user,
            accessToken: response.accessToken,
          })
        );

        if (process.env.NODE_ENV !== "production") {
          console.info("auth_hydration", {
            event: "refresh_succeeded",
            userId: response.user.id,
            epoch: getAuthSessionEpoch(),
          });
        }
      })
      .catch(async (error: unknown) => {
        if (cancelled) return;
        if (hasCompletedLogout() || getAuthSessionEpoch() !== hydrationEpoch) {
          if (process.env.NODE_ENV !== "production") {
            console.info("auth_hydration", {
              event: "stale_refresh_failure_ignored",
              startedEpoch: hydrationEpoch,
              currentEpoch: getAuthSessionEpoch(),
            });
          }
          return;
        }

        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;

        try {
          const session = await hydrateFromStoredAccessToken(apiUrl);

          if (cancelled) return;

          if (session) {
            persistAuthSession(
              session.accessToken,
              session.user,
              session.csrfToken,
              session.refreshToken
            );
            dispatch(
              hydrateAuth({
                user: session.user,
                accessToken: session.accessToken,
              })
            );
          } else if (
            isConfirmedInvalidRefreshError(error) ||
            status === 401 ||
            status === 403
          ) {
            dispatch(hydrateAuth({ user: null, accessToken: null }));
          } else {
            // A failed refresh means the browser currently has no usable
            // cookie session. It is not a logout event and must not clear
            // cookies, revoke sessions, emit logout-style auth events, or
            // redirect immediately.
            dispatch(markAuthUnknown());
          }
        } catch {
          if (cancelled) return;

          if (
            isConfirmedInvalidRefreshError(error) ||
            status === 401 ||
            status === 403
          ) {
            dispatch(hydrateAuth({ user: null, accessToken: null }));
          } else {
            dispatch(markAuthUnknown());
          }
        }

        markPerf("auth-hydration:refresh-end", { status: status ?? 0 });
        measurePerf(
          "auth-hydration:refresh",
          "auth-hydration:refresh-start",
          "auth-hydration:refresh-end",
          { status: status ?? 0 }
        );

        if (process.env.NODE_ENV !== "production") {
          console.info("auth_hydration", {
            event: "refresh_failed",
            status: status ?? null,
            epoch: getAuthSessionEpoch(),
          });
        }
      })
      .finally(() => {
        hydrationInFlight = false;
      });
    };

    void runHydration();

    return () => {
      cancelled = true;
      if (hydrationInFlight && process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "refresh_cancelled",
          epoch: getAuthSessionEpoch(),
        });
      }
      window.removeEventListener(AUTH_SESSION_EVENT, onAuthEvent);
      window.removeEventListener("storage", onStorage);
      authChannel?.removeEventListener("message", onBroadcastMessage);
      authChannel?.close();
    };
  }, [dispatch]);

  return null;
}

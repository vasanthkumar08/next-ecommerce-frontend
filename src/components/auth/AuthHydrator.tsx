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
  getAuthSessionEpoch,
  getPostLoginRefreshDelayMs,
  hasCompletedLogout,
  persistAuthSession,
  shouldSkipRefreshAfterRecentLogin,
} from "@/features/auth/authStorage";
import { useAppDispatch } from "@/store/hooks";
import { markPerf, measurePerf } from "@/lib/perf";
import type { AuthResponse } from "@/features/auth/auth.api";

let appLoadRefreshPromise: Promise<AuthResponse> | null = null;

const getAppLoadRefreshPromise = (): Promise<AuthResponse> => {
  appLoadRefreshPromise ??= refreshAuthSession().finally(() => {
    appLoadRefreshPromise = null;
  });
  return appLoadRefreshPromise;
};

export default function AuthHydrator() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    let hydrationInFlight = false;

    const clearFromAuthEvent = () => {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "local_session_cleared",
          epoch: getAuthSessionEpoch(),
        });
      }

      dispatch(hydrateAuth({ user: null, accessToken: null }));
    };

    const apiUrl = getApiBaseUrl();
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY) {
        clearFromAuthEvent();
      }
    };

    window.addEventListener(AUTH_SESSION_EVENT, clearFromAuthEvent);
    window.addEventListener("storage", onStorage);

    if (!apiUrl) {
      clearFromAuthEvent();
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, clearFromAuthEvent);
        window.removeEventListener("storage", onStorage);
      };
    }

    if (hasCompletedLogout()) {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "refresh_skipped_after_logout",
          epoch: getAuthSessionEpoch(),
        });
      }

      clearFromAuthEvent();
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, clearFromAuthEvent);
        window.removeEventListener("storage", onStorage);
      };
    }

    const runHydration = async () => {
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
          response.csrfToken
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
      .catch((error: unknown) => {
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

        if (isConfirmedInvalidRefreshError(error)) {
          dispatch(hydrateAuth({ user: null, accessToken: null }));
        } else if (status === 401 || status === 403) {
          // A failed refresh means the browser currently has no usable backend
          // session. It is not a logout event and must not clear cookies,
          // revoke sessions, emit global logout-style auth events, or redirect
          // immediately. Mobile browsers can expose cookies to XHR slightly
          // after Set-Cookie is accepted, so this is an unknown state.
          dispatch(markAuthUnknown());
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
      window.removeEventListener(AUTH_SESSION_EVENT, clearFromAuthEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [dispatch]);

  return null;
}

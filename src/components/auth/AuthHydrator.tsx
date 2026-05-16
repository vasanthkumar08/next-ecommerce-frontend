"use client";

import axios from "axios";
import { useEffect } from "react";
import { hydrateAuth } from "@/features/auth/authSlice";
import { getApiBaseUrl } from "@/lib/apiUrl";
import { refreshAuthSession } from "@/lib/axios";
import {
  AUTH_SESSION_EVENT,
  getAuthSessionEpoch,
  getPostLoginRefreshDelayMs,
  hasCompletedLogout,
  persistAuthSession,
} from "@/features/auth/authStorage";
import { useAppDispatch } from "@/store/hooks";
import { markPerf, measurePerf } from "@/lib/perf";

export default function AuthHydrator() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    let hydrationInFlight = false;

    const hydrateFromStorage = () => {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "local_session_cleared",
          epoch: getAuthSessionEpoch(),
        });
      }

      dispatch(hydrateAuth({ user: null, accessToken: null }));
    };

    const apiUrl = getApiBaseUrl();
    window.addEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
    window.addEventListener("storage", hydrateFromStorage);

    if (!apiUrl) {
      hydrateFromStorage();
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
        window.removeEventListener("storage", hydrateFromStorage);
      };
    }

    if (hasCompletedLogout()) {
      if (process.env.NODE_ENV !== "production") {
        console.info("auth_hydration", {
          event: "refresh_skipped_after_logout",
          epoch: getAuthSessionEpoch(),
        });
      }

      hydrateFromStorage();
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
        window.removeEventListener("storage", hydrateFromStorage);
      };
    }

    const runHydration = async () => {
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

      refreshAuthSession()
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

        if (status === 401 || status === 403) {
          // A failed refresh means the browser currently has no usable backend
          // session. It is not a logout event and must not clear cookies,
          // revoke sessions, or emit global logout-style auth events.
          dispatch(hydrateAuth({ user: null, accessToken: null }));
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
      window.removeEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
      window.removeEventListener("storage", hydrateFromStorage);
    };
  }, [dispatch]);

  return null;
}

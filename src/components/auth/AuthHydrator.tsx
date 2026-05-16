"use client";

import axios from "axios";
import { useEffect } from "react";
import { hydrateAuth } from "@/features/auth/authSlice";
import type { AuthResponse } from "@/features/auth/auth.api";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  AUTH_SESSION_EVENT,
  clearLocalAuthSession,
  getAuthSessionEpoch,
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

    const hydrationEpoch = getAuthSessionEpoch();
    hydrationInFlight = true;
    markPerf("auth-hydration:refresh-start", { epoch: hydrationEpoch });

    if (process.env.NODE_ENV !== "production") {
      console.info("auth_hydration", {
        event: "refresh_started",
        epoch: hydrationEpoch,
      });
    }

    axios
      .post<AuthResponse>(`${apiUrl}/v1/auth/refresh`, {}, { withCredentials: true })
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

        persistAuthSession(response.data.accessToken, response.data.user);
        markPerf("auth-hydration:refresh-end", {
          status: 200,
          userId: response.data.user.id,
        });
        measurePerf(
          "auth-hydration:refresh",
          "auth-hydration:refresh-start",
          "auth-hydration:refresh-end",
          { status: 200 }
        );
        dispatch(
          hydrateAuth({
            user: response.data.user,
            accessToken: response.data.accessToken,
          })
        );

        if (process.env.NODE_ENV !== "production") {
          console.info("auth_hydration", {
            event: "refresh_succeeded",
            userId: response.data.user.id,
            epoch: getAuthSessionEpoch(),
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;

        if (status === 401 || status === 403 || status === 429) {
          clearLocalAuthSession();
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

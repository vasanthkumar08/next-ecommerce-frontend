"use client";

import axios from "axios";
import { useEffect } from "react";
import { hydrateAuth } from "@/features/auth/authSlice";
import type { AuthResponse } from "@/features/auth/auth.api";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  AUTH_SESSION_EVENT,
  clearLocalAuthSession,
  getStoredAccessToken,
  getStoredUser,
  persistAuthSession,
} from "@/features/auth/authStorage";
import { useAppDispatch } from "@/store/hooks";

export default function AuthHydrator() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;

    const hydrateFromStorage = () => {
      dispatch(
        hydrateAuth({
          user: getStoredUser(),
          accessToken: getStoredAccessToken(),
        })
      );
    };

    const storedUser = getStoredUser();
    const storedAccessToken = getStoredAccessToken();

    hydrateFromStorage();

    const apiUrl = getApiBaseUrl();
    window.addEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
    window.addEventListener("storage", hydrateFromStorage);

    if (!apiUrl || (!storedUser && !storedAccessToken)) {
      return () => {
        cancelled = true;
        window.removeEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
        window.removeEventListener("storage", hydrateFromStorage);
      };
    }

    axios
      .post<AuthResponse>(`${apiUrl}/v1/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        if (cancelled) return;

        persistAuthSession(response.data.accessToken, response.data.user);
        dispatch(
          hydrateAuth({
            user: response.data.user,
            accessToken: response.data.accessToken,
          })
        );
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
      });

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EVENT, hydrateFromStorage);
      window.removeEventListener("storage", hydrateFromStorage);
    };
  }, [dispatch]);

  return null;
}

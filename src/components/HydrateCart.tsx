"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  hydrateBackendCart,
  hydrateCart,
  markBackendCartHydrationFailed,
  markBackendCartHydrationPending,
  resetBackendCartHydration,
} from "@/features/cart/cartSlice";
import {
  saveCart,
} from "@/features/cart/cartPersist";
import { fetchBackendCart } from "@/features/cart/cartBackend";
import {
  pauseCartSync,
  resumeCartSync,
  isCartSyncInFlight,
  setCartSyncBase,
  suppressNextCartSync,
} from "@/features/cart/cartSync";
import { captureFrontendException, captureFrontendMessage } from "@/lib/observability";

export const CART_HYDRATION_RETRY_EVENT = "vasanthtrends:cart-hydration-retry";
const cartRefreshIntervalMs = 1_500;

export default function HydrateCart({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const authStatus = useAppSelector((state) => state.auth.status);
  const backendRevision = useAppSelector((state) => state.cart.backendRevision);
  const hydrationRun = useRef(0);
  const hydrationFetchInFlight = useRef(false);
  const backendRevisionRef = useRef<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    backendRevisionRef.current = backendRevision;
  }, [backendRevision]);

  useEffect(() => {
    const onRetry = () => setRetryNonce((value) => value + 1);
    window.addEventListener(CART_HYDRATION_RETRY_EVENT, onRetry);
    return () => window.removeEventListener(CART_HYDRATION_RETRY_EVENT, onRetry);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const runId = hydrationRun.current + 1;
    hydrationRun.current = runId;

    if (authStatus === "loading" || authStatus === "unknown") {
      return;
    }

    if (!isAuthenticated || !userId) {
      // Ecommerce data is account-owned only. An unauthenticated browser must
      // not create or display a device-local cart that could later be mistaken
      // for canonical user data.
      setCartSyncBase([]);
      dispatch(resetBackendCartHydration());
      dispatch(hydrateCart([]));
      return;
    }

    const hydrateAuthenticatedCart = async (reason = "initial") => {
      if (hydrationFetchInFlight.current) {
        return;
      }

      if (reason !== "initial" && isCartSyncInFlight()) {
        return;
      }

      hydrationFetchInFlight.current = true;

      // Authenticated cart ownership is backend-first. We pause automatic
      // persistence until the canonical user cart is loaded, so stale local
      // state cannot overwrite the multi-device backend cart.
      pauseCartSync();

      if (reason === "initial") {
        dispatch(markBackendCartHydrationPending());
      }

      try {
        const backendCart = await fetchBackendCart();
        if (cancelled || hydrationRun.current !== runId) return;

        if (
          reason !== "initial" &&
          backendCart.revision !== null &&
          backendCart.revision === backendRevisionRef.current
        ) {
          resumeCartSync();
          return;
        }

        backendRevisionRef.current = backendCart.revision;
        setCartSyncBase(backendCart.items, backendCart.revision);
        suppressNextCartSync(backendCart.items);
        captureFrontendMessage("cart_hydration_success", {
          userId,
          revision: backendCart.revision,
          reason,
        });

        dispatch(
          hydrateBackendCart({
            items: backendCart.items,
            userId,
            revision: backendCart.revision,
            updatedAt: backendCart.updatedAt,
          })
        );
        saveCart(backendCart.items, userId);

        if (!cancelled && hydrationRun.current === runId) {
          resumeCartSync();
        }
      } catch (error) {
        if (!cancelled && hydrationRun.current === runId) {
          // Do not hydrate a stale authenticated local cart or sync anything
          // to the backend when the canonical backend cart could not load.
          dispatch(markBackendCartHydrationFailed());
          captureFrontendException(error, {
            area: "cart_hydration",
            userId,
          });
          suppressNextCartSync([]);
          resumeCartSync();
        }
      } finally {
        hydrationFetchInFlight.current = false;
      }
    };

    void hydrateAuthenticatedCart();

    const refreshCart = () => {
      if (document.visibilityState === "visible") {
        void hydrateAuthenticatedCart("background_refresh");
      }
    };
    const onFocus = () => void hydrateAuthenticatedCart("focus");
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void hydrateAuthenticatedCart("visibility");
      }
    };
    const interval = window.setInterval(refreshCart, cartRefreshIntervalMs);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authStatus, dispatch, isAuthenticated, retryNonce, userId]);

  return <>{children}</>;
}

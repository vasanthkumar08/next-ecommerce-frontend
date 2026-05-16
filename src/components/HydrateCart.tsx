"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { hydrateCart } from "@/features/cart/cartSlice";
import {
  clearGuestCart,
  loadCart,
  loadGuestCart,
  loadUserCart,
  mergeCartItems,
  saveCart,
} from "@/features/cart/cartPersist";
import { fetchBackendCart } from "@/features/cart/cartBackend";
import {
  pauseCartSync,
  resumeCartSync,
  syncCartToBackendNow,
} from "@/features/cart/cartSync";

export default function HydrateCart({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const authStatus = useAppSelector((state) => state.auth.status);
  const hydrationRun = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const runId = hydrationRun.current + 1;
    hydrationRun.current = runId;

    if (authStatus === "loading" || authStatus === "unknown") {
      return;
    }

    if (!isAuthenticated || !userId) {
      // Logout should switch the visible cart to the guest cart without
      // deleting or overwriting the authenticated user's backend cart.
      dispatch(hydrateCart(loadCart(null)));
      return;
    }

    const hydrateAuthenticatedCart = async () => {
      // Authenticated cart ownership is backend-first. We pause automatic
      // persistence while login hydration merges guest items so stale local
      // state cannot overwrite the multi-device backend cart.
      pauseCartSync();

      const localUserCart = loadUserCart(userId);
      const guestCart = loadGuestCart();
      dispatch(hydrateCart(localUserCart));

      try {
        const backendCart = await fetchBackendCart();
        if (cancelled || hydrationRun.current !== runId) return;

        const mergedCart =
          guestCart.length > 0
            ? mergeCartItems(backendCart, guestCart)
            : backendCart;

        dispatch(hydrateCart(mergedCart));
        saveCart(mergedCart, userId);

        if (guestCart.length > 0) {
          const synced = await syncCartToBackendNow(mergedCart, true);

          if (!cancelled && hydrationRun.current === runId && synced) {
            clearGuestCart();
          }
        }

        if (!cancelled && hydrationRun.current === runId) {
          resumeCartSync();
        }
      } catch {
        if (!cancelled && hydrationRun.current === runId) {
          // Keep guest cart if merge failed; it can be retried on the next
          // successful authenticated hydration instead of being lost.
          dispatch(hydrateCart(localUserCart));
          resumeCartSync();
        }
      }
    };

    void hydrateAuthenticatedCart();

    return () => {
      cancelled = true;
    };
  }, [authStatus, dispatch, isAuthenticated, userId]);

  return <>{children}</>;
}

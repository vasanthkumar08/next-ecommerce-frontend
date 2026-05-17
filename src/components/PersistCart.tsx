"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { saveCart } from "@/features/cart/cartPersist";
import {
  isCartSyncPaused,
  syncCartToBackend,
} from "@/features/cart/cartSync";

export default function PersistCart() {
  const items = useAppSelector((state) => state.cart.items);
  const hydrated = useAppSelector((state) => state.cart.hydrated);
  const backendHydrated = useAppSelector((state) => state.cart.backendHydrated);
  const backendHydratedUserId = useAppSelector(
    (state) => state.cart.backendHydratedUserId
  );
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const authStatus = useAppSelector((state) => state.auth.status);
  const logoutLoading = useAppSelector((state) => state.auth.logoutLoading);

  useEffect(() => {
    if (!hydrated) return;

    // Cart persistence is user data, not session data. During logout we pause
    // writes so clearing auth cannot cascade into an empty backend cart update.
    if (logoutLoading) {
      return;
    }

    const canPersistAuthenticatedCache =
      isAuthenticated &&
      authStatus === "authenticated" &&
      backendHydrated &&
      backendHydratedUserId === userId;

    if (canPersistAuthenticatedCache) {
      saveCart(items, userId);
    }

    if (canPersistAuthenticatedCache) {
      if (isCartSyncPaused()) {
        return;
      }
      syncCartToBackend(items, true, userId);
    }
  }, [
    authStatus,
    backendHydrated,
    backendHydratedUserId,
    hydrated,
    isAuthenticated,
    items,
    logoutLoading,
    userId,
  ]);

  return null;
}

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
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const logoutLoading = useAppSelector((state) => state.auth.logoutLoading);

  useEffect(() => {
    if (!hydrated) return;

    // Cart persistence is user data, not session data. During logout we pause
    // writes so clearing auth cannot cascade into an empty backend cart update.
    if (logoutLoading) {
      return;
    }

    saveCart(items, userId);

    if (isAuthenticated) {
      if (isCartSyncPaused()) {
        return;
      }
      syncCartToBackend(items, true);
    }
  }, [hydrated, isAuthenticated, items, logoutLoading, userId]);

  return null;
}

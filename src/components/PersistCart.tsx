"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { saveCart } from "@/features/cart/cartPersist";
import { syncCartToBackend } from "@/features/cart/cartSync";

export default function PersistCart() {
  const items = useAppSelector((state) => state.cart.items);
  const hydrated = useAppSelector((state) => state.cart.hydrated);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (hydrated) {
      saveCart(items, userId);
      syncCartToBackend(items, isAuthenticated);
    }
  }, [hydrated, isAuthenticated, items, userId]);

  return null;
}

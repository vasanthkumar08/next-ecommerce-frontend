"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { hydrateCart } from "@/features/cart/cartSlice";
import { loadCart } from "@/features/cart/cartPersist";
import { fetchBackendCart } from "@/features/cart/cartBackend";

export default function HydrateCart({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      dispatch(hydrateCart(loadCart(null)));
      return;
    }

    dispatch(hydrateCart(loadCart(userId)));

    fetchBackendCart()
      .then((items) => {
        if (!cancelled) {
          dispatch(hydrateCart(items));
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch(hydrateCart(loadCart(userId)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, isAuthenticated, userId]);

  return <>{children}</>;
}

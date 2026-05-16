"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearWishlist,
  hydrateWishlist,
} from "@/features/wishlist/wishlistSlice";

export default function HydrateWishlist() {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.status);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const hydratedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === "loading" || authStatus === "unknown") {
      return;
    }

    if (authStatus === "guest") {
      hydratedForUserRef.current = null;
      // Logout only removes sensitive client-visible state. Backend wishlist is
      // user-owned data and remains untouched for the next session/device.
      dispatch(clearWishlist());
      return;
    }

    if (!userId || hydratedForUserRef.current === userId) {
      return;
    }

    hydratedForUserRef.current = userId;
    void dispatch(hydrateWishlist());
  }, [authStatus, dispatch, userId]);

  return null;
}

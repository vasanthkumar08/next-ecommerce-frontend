"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { hydrateCart } from "@/features/cart/cartSlice";
import { loadCart } from "@/features/cart/cartPersist";

export default function HydrateCart({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);

  useEffect(() => {
    dispatch(hydrateCart(loadCart(userId)));
  }, [dispatch, userId]);

  return <>{children}</>;
}

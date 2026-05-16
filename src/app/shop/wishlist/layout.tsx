"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute nextPath="/shop/wishlist">
      {children}
    </ProtectedRoute>
  );
}

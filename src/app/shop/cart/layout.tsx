"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute nextPath="/shop/cart">
      {children}
    </ProtectedRoute>
  );
}

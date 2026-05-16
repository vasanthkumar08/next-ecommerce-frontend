"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute nextPath="/shop/orders">
      {children}
    </ProtectedRoute>
  );
}

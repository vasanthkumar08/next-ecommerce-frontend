"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute nextPath="/shop/checkout">
      {children}
    </ProtectedRoute>
  );
}

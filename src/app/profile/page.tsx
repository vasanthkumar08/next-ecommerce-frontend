"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ProfilePage from "@/components/ProfilePage";

export default function Page() {
  return (
    <ProtectedRoute nextPath="/profile">
      <ProfilePage />
    </ProtectedRoute>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";

export default function ProtectedRoute({
  children,
  nextPath,
}: {
  children: React.ReactNode;
  nextPath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading, hydrated, status } = useAppSelector(
    (state) => state.auth
  );
  const redirectTarget = nextPath ?? pathname;

  useEffect(() => {
    if (hydrated && !loading && status === "guest") {
      if (process.env.NODE_ENV !== "production") {
        console.info("client_auth_guard", {
          event: "redirect_to_login",
          path: redirectTarget,
          reason: "hydrated_guest",
        });
      }

      router.replace(`/login?next=${encodeURIComponent(redirectTarget)}`);
    }
  }, [hydrated, loading, redirectTarget, router, status]);

  if (!hydrated || loading || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a73e8] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

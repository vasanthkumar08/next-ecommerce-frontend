"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { captureFrontendMessage } from "@/lib/observability";

const authRestoreTimeoutMs = 12_000;

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
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  const redirectTarget = nextPath ?? pathname;

  useEffect(() => {
    if (hydrated && !loading && status !== "loading" && status !== "unknown") {
      setRestoreTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setRestoreTimedOut(true);
      captureFrontendMessage("auth_unknown_timeout_total", {
        path: redirectTarget,
        status,
      });
    }, authRestoreTimeoutMs);

    return () => window.clearTimeout(timer);
  }, [hydrated, loading, redirectTarget, status]);

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

  if (!hydrated || loading || status === "loading" || status === "unknown") {
    if (restoreTimedOut) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto h-8 w-8 rounded-full border-4 border-[#1a73e8] border-t-transparent" />
            <h1 className="mt-5 text-lg font-bold text-slate-950">
              Session restore is taking too long
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Your browser may have paused cookies or network access. Try again
              or sign in to continue.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  router.replace(`/login?next=${encodeURIComponent(redirectTarget)}`)
                }
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a73e8] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { logout } from "@/features/auth/authSlice";
import { getStoredAccessToken, getStoredUser } from "@/features/auth/authStorage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { markPerf, measurePerf } from "@/lib/perf";

type SessionInfo = {
  browser: string;
  device: string;
  lastActivity: string;
};

const LAST_ACTIVITY_KEY = "smarttrends.security.lastActivity";
const SESSION_TIMEOUT_KEY = "smarttrends.security.timeoutMinutes";

const getBrowserName = (agent: string) => {
  if (agent.includes("Edg/")) return "Microsoft Edge";
  if (agent.includes("Chrome/")) return "Chrome";
  if (agent.includes("Firefox/")) return "Firefox";
  if (agent.includes("Safari/")) return "Safari";
  return "Current browser";
};

const getDeviceName = (agent: string) => {
  if (/mobile|android|iphone|ipad/i.test(agent)) return "Mobile device";
  if (/windows/i.test(agent)) return "Windows device";
  if (/mac/i.test(agent)) return "Mac device";
  return "Current device";
};

const readSessionInfo = (): SessionInfo => {
  if (typeof window === "undefined") {
    return {
      browser: "Current browser",
      device: "Current device",
      lastActivity: "Active now",
    };
  }

  const agent = window.navigator.userAgent;
  const previousActivity = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  const activity = new Date().toISOString();
  window.localStorage.setItem(LAST_ACTIVITY_KEY, activity);

  return {
    browser: getBrowserName(agent),
    device: getDeviceName(agent),
    lastActivity: previousActivity
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(previousActivity))
      : "Active now",
  };
};

export default function SecuritySettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState("10080");
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const storedUser = useMemo(() => getStoredUser(), []);
  const hasToken = useMemo(() => Boolean(getStoredAccessToken()), []);
  const user = auth.user ?? storedUser;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSessionInfo(readSessionInfo());
      const storedTimeout = window.localStorage.getItem(SESSION_TIMEOUT_KEY);
      if (storedTimeout) {
        setTimeoutMinutes(storedTimeout);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const saveTimeout = (value: string) => {
    setTimeoutMinutes(value);
    window.localStorage.setItem(SESSION_TIMEOUT_KEY, value);
  };

  const revokeCurrentSession = () => {
    markPerf("logout:click", { source: "security-settings" });
    void dispatch(logout("security-settings"));
    router.replace("/");
    markPerf("logout:redirect-fired", { source: "security-settings" });
    measurePerf(
      "logout:click-to-redirect",
      "logout:click",
      "logout:redirect-fired",
      { source: "security-settings" }
    );
    router.refresh();
  };

  const requestPasswordReset = () => {
    setResetStatus(
      user?.email
        ? `Password reset instructions are ready for ${user.email}.`
        : "Sign in to request a password reset for your account."
    );
  };

  const securityItems = [
    {
      icon: MonitorSmartphone,
      title: "Active sessions",
      body: sessionInfo
        ? `${sessionInfo.device} • ${sessionInfo.browser} • ${sessionInfo.lastActivity}`
        : "Checking current device...",
    },
    {
      icon: KeyRound,
      title: "Password reset",
      body: "Secure reset links should be short-lived and single-use.",
    },
    {
      icon: ShieldCheck,
      title: "Secure checkout",
      body: "Orders are verified by the backend before payment confirmation.",
    },
  ] as const;

  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
          <ShieldCheck className="h-7 w-7 text-[#ff6700]" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">
            Privacy & Security
          </h1>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {securityItems.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <Icon className="h-5 w-5 text-[#ff6700]" />
                <p className="mt-3 font-black text-slate-950">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-black text-slate-950">Current session</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {user?.email ?? "No signed-in account detected"}
                  </p>
                </div>
                <button
                  onClick={revokeCurrentSession}
                  disabled={!auth.isAuthenticated && !hasToken}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  Revoke
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Browser
                  </p>
                  <p className="mt-2 font-bold text-slate-950">
                    {sessionInfo?.browser ?? "Checking..."}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Last activity
                  </p>
                  <p className="mt-2 font-bold text-slate-950">
                    {sessionInfo?.lastActivity ?? "Active now"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-[#ff6700]" />
                <p className="font-black text-slate-950">Session timeout</p>
              </div>
              <select
                value={timeoutMinutes}
                onChange={(event) => saveTimeout(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#ff6700]"
              >
                <option value="1440">1 day</option>
                <option value="4320">3 days</option>
                <option value="10080">7 days</option>
              </select>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Token lifetime is still enforced by the backend; this setting
                keeps the browser-side preference aligned with your account.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#ff6700]" />
                <p className="font-black text-slate-950">Password controls</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={requestPasswordReset}
                  className="rounded-2xl bg-[#ff6700] px-5 py-3 text-sm font-black text-white transition hover:bg-[#f05f00]"
                >
                  Request Reset
                </button>
                <Link
                  href="/settings/profile"
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700]"
                >
                  Change Password
                </Link>
              </div>
              {resetStatus && (
                <p className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-semibold text-[#a84400]">
                  {resetStatus}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#ff6700]" />
                <p className="font-black text-slate-950">Login activity</p>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-950">No suspicious login</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  New device alerts should be sent from the backend when a
                  future session API records IP and device fingerprints.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/settings"
            className="mt-6 inline-flex rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700]"
          >
            Back to Settings
          </Link>
        </section>
      </div>
    </main>
  );
}

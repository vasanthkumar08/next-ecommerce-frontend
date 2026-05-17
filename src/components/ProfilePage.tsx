"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Camera,
  Heart,
  KeyRound,
  MapPin,
  Package,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
  WalletCards,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/features/auth/authSlice";
import { loadOrders } from "@/features/orders/ordersSlice";
import { countRender, markPerf, measurePerf } from "@/lib/perf";
import api from "@/lib/axios";
import { toast } from "sonner";

const avatarUrl =
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=85";

const sidebarLinks = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Orders", href: "/shop/orders", icon: Package },
  { label: "Wishlist", href: "/shop/wishlist", icon: Heart },
  { label: "Addresses", href: "/settings#addresses", icon: MapPin },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export default function ProfilePage() {
  countRender("ProfilePage");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const authHydrated = useAppSelector((state) => state.auth.hydrated);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const authStatus = useAppSelector((state) => state.auth.status);
  const logoutLoading = useAppSelector((state) => state.auth.logoutLoading);
  const wishlistCount = useAppSelector((state) => state.wishlist.items.length);
  const orders = useAppSelector((state) => state.orders.items);
  const ordersLoading = useAppSelector((state) => state.orders.loading);

  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [phone, setPhone] = useState(authUser?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const name = nameOverride ?? authUser?.name ?? "";
  const email = authUser?.email ?? "";
  const canUseAccount =
    authStatus === "authenticated" ||
    (authStatus === "unknown" && isAuthenticated);

  useEffect(() => {
    if (!authHydrated || logoutLoading) return;
    if (authStatus !== "guest") return;

    if (!isAuthenticated) {
      if (process.env.NODE_ENV !== "production") {
        console.info("client_auth_guard", {
          event: "redirect_to_login",
          path: "/profile",
          reason: "hydrated_unauthenticated",
        });
      }

      router.replace("/login?next=/profile");
    }
  }, [authHydrated, authStatus, isAuthenticated, logoutLoading, router]);

  useEffect(() => {
    if (canUseAccount && authUser?.id) {
      void dispatch(loadOrders(authUser.id));
    }
  }, [canUseAccount, authUser?.id, dispatch]);

  useEffect(() => {
    if (!authHydrated || !canUseAccount) return;

    let cancelled = false;

    api
      .get<{ data: { name?: string; email?: string; phone?: string } }>(
        "/v1/users/me"
      )
      .then((response) => {
        if (cancelled) return;
        setNameOverride(response.data.data.name ?? authUser?.name ?? "");
        setPhone(response.data.data.phone ?? authUser?.phone ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPhone(authUser?.phone ?? "");
      });

    return () => {
      cancelled = true;
    };
  }, [authHydrated, authUser?.name, authUser?.phone, canUseAccount]);

  const handleSaveProfile = async () => {
    if (!canUseAccount) {
      toast.info("Loading...");
      return;
    }

    try {
      setSavingProfile(true);
      const response = await api.put<{
        data: { name?: string; phone?: string };
      }>("/v1/users/me", {
        name: name.trim(),
        phone: phone.trim(),
      });

      setNameOverride(response.data.data.name ?? name.trim());
      setPhone(response.data.data.phone ?? phone.trim());
      toast.success("Success");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!authHydrated || logoutLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ff6700] border-t-transparent" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const recentOrders = orders.slice(0, 3);
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

  const stats = [
    {
      label: "Total Orders",
      value: orders.length.toString(),
      icon: ShoppingBag,
    },
    {
      label: "Wishlist Items",
      value: wishlistCount.toString(),
      icon: Heart,
    },
    {
      label: "Total Spent",
      value: `₹${totalSpent.toLocaleString("en-IN")}`,
      icon: WalletCards,
    },
  ] as const;

  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-3 rounded-3xl bg-orange-50 p-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full">
                <Image
                  src={avatarUrl}
                  alt={`${name || "Profile"} profile avatar`}
                  fill
                  sizes="56px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-slate-950">
                  {name || "Profile"}
                </p>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {email}
                </p>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              {sidebarLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-orange-50 hover:text-[#ff6700]"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <button
              disabled={logoutLoading}
              onClick={() => {
                markPerf("logout:click", { source: "profile" });
                void dispatch(logout("profile"));
                router.replace("/");
                markPerf("logout:redirect-fired", { source: "profile" });
                measurePerf(
                  "logout:click-to-redirect",
                  "logout:click",
                  "logout:redirect-fired",
                  { source: "profile" }
                );
                router.refresh();
              }}
              className="mt-4 w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-100 active:scale-95"
            >
              Sign out
            </button>
          </aside>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-xl">
                  <Image
                    src={avatarUrl}
                    alt={`${name || "Profile"} avatar`}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                  <button
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#ff6700] text-white shadow-lg transition hover:bg-[#f05f00]"
                    aria-label="Edit avatar"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ff6700]">
                    My Profile
                  </p>
                  <h1 className="mt-2 text-3xl font-black text-slate-950">
                    {name || "Profile"}
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Account details and order activity
                  </p>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  <ShieldCheck className="mb-2 h-5 w-5" />
                  Secure checkout enabled
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {stats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Icon className="h-6 w-6 text-[#ff6700]" />
                  <p className="mt-4 text-3xl font-black text-slate-950">
                    {value}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
                <h2 className="text-xl font-black text-slate-950">
                  Edit Profile
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Name
                    <input
                      value={name}
                      onChange={(event) => setNameOverride(event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#ff6700] focus:ring-2 focus:ring-orange-500/15"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Phone
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#ff6700] focus:ring-2 focus:ring-orange-500/15"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                    Email
                    <input
                      value={email}
                      readOnly
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-500 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => void handleSaveProfile()}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ff6700] px-5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-[#f05f00] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                  <KeyRound className="h-5 w-5 text-[#ff6700]" />
                  Change Password
                </h2>
                <div className="mt-5 grid gap-4">
                  {["Current password", "New password", "Confirm password"].map(
                    (label) => (
                      <label
                        key={label}
                        className="grid gap-2 text-sm font-bold text-slate-700"
                      >
                        {label}
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#ff6700] focus:ring-2 focus:ring-orange-500/15"
                        />
                      </label>
                    )
                  )}
                  <button className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 transition hover:-translate-y-0.5 hover:border-[#ff6700] hover:text-[#ff6700] active:scale-95">
                    Update Password
                  </button>
                </div>
              </section>
            </div>

            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Recent Orders
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Quick preview of your latest purchases.
                  </p>
                </div>
                <Link
                  href="/shop/orders"
                  className="rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-[#ff6700] transition hover:bg-[#ff6700] hover:text-white"
                >
                  View all
                </Link>
              </div>

              <div className="grid gap-3">
                {ordersLoading ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                    Loading...
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                    No orders yet.
                  </div>
                ) : recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {order.items[0]?.title ?? "Order"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {order.id} • {new Date(order.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        {order.status}
                      </span>
                      <span className="font-black text-slate-950">
                        ₹{order.total.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}

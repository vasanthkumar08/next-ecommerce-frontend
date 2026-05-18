"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { House, Package, ShoppingBag, ShoppingCart, User } from "lucide-react";
import { useAppSelector } from "@/store/hooks";

const navItems = [
  { label: "Home", href: "/", icon: House, requiresAuth: false },
  {
    label: "Shop",
    href: "/shop/products",
    icon: ShoppingBag,
    requiresAuth: false,
  },
  { label: "Cart", href: "/shop/cart", icon: ShoppingCart, requiresAuth: true },
  { label: "Orders", href: "/shop/orders", icon: Package, requiresAuth: true },
  { label: "Profile", href: "/profile", icon: User, requiresAuth: true },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const cartCount = useAppSelector((state) =>
    state.cart.items.reduce((total, item) => total + item.quantity, 0)
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200/80 bg-white/95 px-2 pt-2 shadow-2xl shadow-slate-950/15 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map(({ label, href, icon: Icon, requiresAuth }) => {
          const active = isActive(href);
          const isCart = label === "Cart";

          return (
            <Link
              key={label}
              href={href}
              onClick={(event) => {
                if (!requiresAuth || isAuthenticated) return;

                event.preventDefault();
                router.push(`/login?next=${encodeURIComponent(href)}`);
              }}
              data-cart-target={isCart ? "mobile" : undefined}
              className="relative min-w-0 rounded-2xl px-1 py-1.5 text-center"
              aria-current={active ? "page" : undefined}
            >
              <motion.span
                whileTap={{ scale: 0.92 }}
                animate={{ scale: active ? 1.06 : 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`mx-auto flex h-9 w-11 items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-orange-50 text-[#ff6700] shadow-sm ring-1 ring-orange-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                  active ? "fill-orange-500/10 stroke-[2.6]" : ""
                  }`}
                />
              </motion.span>
              <span
                className={`mt-1 block truncate text-[11px] font-black ${
                  active ? "text-[#ff6700]" : "text-slate-500"
                }`}
              >
                {label}
              </span>
              {isCart && cartCount > 0 && (
                <span className="absolute right-2 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6700] px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

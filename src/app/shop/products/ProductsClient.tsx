"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProductFilters } from "@/hooks/useProductFilters";
import type { Product } from "@/types/product";
import ProductGrid from "@/components/product/ProductGrid";
import Sidebar from "@/components/layout/Sidebar";
import Filters from "@/components/product/ProductFilters";
import ActiveFilterBadges from "@/components/product/ActiveFilterBadges";

type SortKey = "default" | "price-asc" | "price-desc" | "rating";

interface ProductsClientProps {
  initialProducts: Product[];
  total: number;
  page: number;
  pages: number;
  serverError?: string;
}

const getSortValue = (value: string | null): SortKey => {
  if (value === "price-asc" || value === "price-desc" || value === "rating") {
    return value;
  }

  return "default";
};

function pageHref(searchParams: URLSearchParams, page: number) {
  const next = new URLSearchParams(searchParams);
  next.set("page", String(page));
  return `/shop/products?${next.toString()}`;
}

export default function ProductsClient({
  initialProducts,
  total,
  page,
  pages,
  serverError,
}: ProductsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>(() =>
    getSortValue(searchParams.get("sort"))
  );

  const {
    filters,
    filtered,
    categories,
    priceFloor,
    priceCeiling,
    activeCount,
    setCategory,
    setPriceRange,
    setMinRating,
    setSearch,
    clearFilters,
    clearCategory,
    clearPrice,
    clearRating,
    clearSearch,
  } = useProductFilters(initialProducts);

  useEffect(() => {
    setCategory(searchParams.get("cat")?.trim() || "all");
    setSearch(searchParams.get("q")?.trim() || "");
    setSort(getSortValue(searchParams.get("sort")));
  }, [searchParams, setCategory, setSearch]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const displayed = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return (b.rating?.rate ?? 0) - (a.rating?.rate ?? 0);
      return 0;
    });
  }, [filtered, sort]);

  const currentParams = useMemo(
    () => new URLSearchParams(searchParams),
    [searchParams]
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">All Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Discover our full collection
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-[#ff6700] hover:text-[#ff6700] lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M6 12h12M9 18h6" strokeLinecap="round" />
            </svg>
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6700] text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>

          <div className="flex-1" />

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#ff6700]"
          >
            <option value="default">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        <div className="mb-4">
          <ActiveFilterBadges
            filters={filters}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            onClearCategory={clearCategory}
            onClearPrice={clearPrice}
            onClearRating={clearRating}
            onClearSearch={clearSearch}
          />
        </div>

        <div className="flex gap-6">
          <Sidebar open={sidebarOpen} onClose={closeSidebar}>
            <Filters
              filters={filters}
              categories={categories}
              priceFloor={priceFloor}
              priceCeiling={priceCeiling}
              onCategory={setCategory}
              onPriceRange={setPriceRange}
              onRating={setMinRating}
              onClear={clearFilters}
              activeCount={activeCount}
            />
          </Sidebar>

          <div className="min-w-0 flex-1">
            {serverError && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{serverError}</p>
                <button
                  onClick={() => router.refresh()}
                  className="rounded-lg bg-[#ff6700] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#f05f00]"
                >
                  Retry
                </button>
              </div>
            )}

            {!serverError && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {displayed.length}
                  </span>{" "}
                  shown from {total} products
                  {activeCount > 0 && (
                    <span className="ml-2 text-[#ff6700]">
                      ({activeCount} filter{activeCount > 1 ? "s" : ""} active)
                    </span>
                  )}
                </p>
                {activeCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-[#dc2626] transition hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {!serverError && displayed.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#e0e0e0] bg-white py-20 text-center shadow-sm">
                <p className="mb-1 text-4xl">No matches</p>
                <p className="mb-1 font-semibold text-slate-800">
                  No products match your filters
                </p>
                <p className="mb-5 text-sm text-slate-500">
                  Try adjusting category, price or rating.
                </p>
                <button
                  onClick={clearFilters}
                  className="rounded-lg bg-[#ff6700] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#f05f00]"
                >
                  Clear Filters
                </button>
              </div>
            )}

            <ProductGrid products={displayed} />

            {pages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2">
                <Link
                  aria-disabled={page <= 1}
                  href={pageHref(currentParams, Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  Previous
                </Link>
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                  Page {page} of {pages}
                </span>
                <Link
                  aria-disabled={page >= pages}
                  href={pageHref(currentParams, Math.min(pages, page + 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  Next
                </Link>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

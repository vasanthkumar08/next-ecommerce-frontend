"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProducts,
  selectProducts,
  selectProductStatus,
  selectProductError,
} from "@/features/product/productSlice";
import ProductCard from "@/components/ui/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import HeroCarousel from "@/components/HeroCarousel";
import type { Product } from "@/types/product";

interface ProductSectionProps {
  title: string;
  subtitle: string;
  href: string;
  products: Product[];
  loading: boolean;
  showEmpty?: boolean;
}

const CATEGORY_LINKS = [
  { label: "All Products", category: "all", href: "/shop/products", image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80" },
  { label: "Electronics", category: "electronics", href: "/shop/products?cat=electronics" },
  { label: "Fashion", category: "fashion", href: "/shop/products?cat=fashion", image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80" },
  { label: "Menswear", category: "men's clothing", href: "/shop/products?cat=men%27s%20clothing" },
  { label: "Womenswear", category: "women's clothing", href: "/shop/products?cat=women%27s%20clothing" },
  { label: "Jewelery", category: "jewelery", href: "/shop/products?cat=jewelery" },
  { label: "Grocery", category: "grocery", href: "/shop/products?cat=grocery", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80" },
  { label: "Premium Dry Fruits", category: "premium dry fruits", href: "/shop/products?cat=premium%20dry%20fruits", image: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=900&q=80" },
  { label: "Home", category: "home", href: "/shop/products?cat=home", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80" },
  { label: "Kitchen", category: "kitchen", href: "/shop/products?cat=kitchen", image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80" },
  { label: "Accessories", category: "accessories", href: "/shop/products?cat=accessories", image: "https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=900&q=80" },
] as const;

const PREMIUM_CATEGORY_GROUPS = [
  {
    title: "Premium Dry Fruits",
    href: "/shop/products?cat=premium%20dry%20fruits",
    items: [
      {
        name: "Almonds",
        image:
          "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Cashews",
        image:
          "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Pistachios",
        image:
          "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Walnuts",
        image:
          "https://images.unsplash.com/photo-1615485291262-015b0e8f6f2f?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    title: "Grocery",
    href: "/shop/products?cat=grocery",
    items: [
      {
        name: "Rice",
        image:
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Spices",
        image:
          "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Oil",
        image:
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Grains",
        image:
          "https://images.unsplash.com/photo-1604908812863-6d1f6f6f49f8?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    title: "Home Applications",
    href: "/shop/products?cat=home",
    items: [
      {
        name: "Lighting",
        image:
          "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Storage",
        image:
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    title: "Kitchen Essentials",
    href: "/shop/products?cat=kitchen",
    items: [
      {
        name: "Cookware",
        image:
          "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Prep Tools",
        image:
          "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    title: "Accessories",
    href: "/shop/products?cat=accessories",
    items: [
      {
        name: "Bags",
        image:
          "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Daily Carry",
        image:
          "https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
] as const;

const sectionSkeletons = Array.from({ length: 5 }, (_, index) => index);

const normalizeCategory = (category: string) => category.trim().toLowerCase();

const categoryAliases: Record<string, string[]> = {
  fashion: ["fashion", "men's clothing", "women's clothing"],
  menswear: ["men's clothing"],
  womenswear: ["women's clothing"],
  "premium dry fruits": ["premium dry fruits", "dry fruits", "grocery"],
};

const productMatchesCategory = (product: Product, category: string) => {
  const selected = normalizeCategory(category);
  const actual = normalizeCategory(product.category);

  if (selected === "all") return true;

  return (categoryAliases[selected] ?? [selected]).includes(actual);
};

const productsByCategory = (products: Product[], category: string) =>
  products.filter((product) => productMatchesCategory(product, category));

const ProductSection = memo(function ProductSection({
  title,
  subtitle,
  href,
  products,
  loading,
  showEmpty = false,
}: ProductSectionProps) {
  if (!loading && products.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-800">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-[#ff6700] transition hover:-translate-y-0.5 hover:bg-[#ff6700] hover:text-white active:scale-95"
        >
          View all
        </Link>
      </div>
      <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 sm:gap-6">
        {loading
          ? sectionSkeletons.slice(0, 4).map((item) => (
              <ProductCardSkeleton key={item} />
            ))
          : products.length > 0 ? products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} compact />
            )) : (
              <div className="col-span-full rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-5 py-10 text-center">
                <p className="font-bold text-slate-800">
                  No products found in this category
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Use Show all products to continue browsing.
                </p>
              </div>
            )}
      </div>
    </section>
  );
});

function HomeSkeletonBand() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {sectionSkeletons.map((item) => (
        <ProductCardSkeleton key={item} />
      ))}
    </div>
  );
}

function HomeEmptyState() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <h2 className="text-2xl font-black text-slate-800">No products available</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Products will appear here as soon as they are added from the admin panel.
      </p>
      <Link
        href="/shop/products"
        className="mt-6 inline-flex rounded-full bg-[#ff6700] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-[#f05f00] active:scale-95"
      >
        Browse shop
      </Link>
    </section>
  );
}

function PremiumCategoryShowcase({ loading }: { loading: boolean }) {
  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">
            Premium Categories
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Image-rich collections for faster category browsing.
          </p>
        </div>
        <Link
          href="/shop/products"
          className="w-fit rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-[#ff6700] transition hover:-translate-y-0.5 hover:bg-[#ff6700] hover:text-white active:scale-95"
        >
          Browse all
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {PREMIUM_CATEGORY_GROUPS.map((group) => (
          <Link
            key={group.title}
            href={group.href}
            aria-label={`Shop ${group.title}`}
            className="group rounded-3xl border border-slate-200 bg-white p-3 shadow-sm outline-none transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md focus-visible:border-[#ff6700] focus-visible:ring-2 focus-visible:ring-orange-200 active:scale-[0.98]"
          >
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((item) => (
                <div
                  key={item.name}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100"
                >
                  {loading ? (
                    <div className="h-full animate-pulse bg-slate-200" />
                  ) : (
                    <Image
                      src={item.image}
                      alt={`${group.title} ${item.name}`}
                      fill
                      sizes="(max-width: 1024px) 50vw, 10vw"
                      loading="lazy"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-1 pb-1 pt-3">
              <p className="font-black text-slate-900">{group.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {group.items.map((item) => item.name).join(" • ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const dispatch = useAppDispatch();
  const productSectionRef = useRef<HTMLDivElement | null>(null);
  const products = useAppSelector(selectProducts);
  const status = useAppSelector(selectProductStatus);
  const error = useAppSelector(selectProductError);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (status === "idle") dispatch(fetchProducts());
  }, [dispatch, status]);

  const isLoading = status === "loading";
  const isEmpty = status === "succeeded" && products.length === 0;

  const categoryCards = useMemo(
    () =>
      CATEGORY_LINKS.map((category) => ({
        ...category,
        image:
          ("image" in category ? category.image : undefined) ??
          products.find((product) =>
            productMatchesCategory(product, category.category)
          )
            ?.image ?? products[0]?.image,
      })),
    [products]
  );

  const selectedCategoryMeta = useMemo(
    () =>
      CATEGORY_LINKS.find((category) => category.category === selectedCategory),
    [selectedCategory]
  );

  const categoryFilteredProducts = useMemo(
    () =>
      selectedCategory === "all"
        ? products
        : productsByCategory(products, selectedCategory),
    [products, selectedCategory]
  );

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    window.requestAnimationFrame(() => {
      productSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const electronics = useMemo(
    () =>
      productsByCategory(products, "electronics")
        .sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0))
        .slice(0, 5),
    [products]
  );

  const deals = useMemo(
    () => [...products].sort((a, b) => a.price - b.price).slice(0, 5),
    [products]
  );

  const topRated = useMemo(
    () =>
      [...products]
        .sort((a, b) => (b.rating?.rate ?? 0) - (a.rating?.rate ?? 0))
        .slice(0, 5),
    [products]
  );

  const fashionProducts = useMemo(
    () => productsByCategory(products, "fashion").reverse().slice(0, 5),
    [products]
  );

  const dryFruitProducts = useMemo(
    () =>
      productsByCategory(products, "premium dry fruits")
        .sort((a, b) => a.price - b.price)
        .slice(0, 5),
    [products]
  );

  const bestSellers = useMemo(
    () => products.filter((product) => product.rating?.count > 200).slice(0, 5),
    [products]
  );

  const recentlyViewed = useMemo(() => products.slice(5, 10), [products]);

  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <HeroCarousel />

        <PremiumCategoryShowcase loading={isLoading} />

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Shop by Categories
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Image-led discovery, optimized for quick scanning.
              </p>
            </div>
            {selectedCategory !== "all" && (
              <button
                type="button"
                onClick={() => handleCategorySelect("all")}
                className="shrink-0 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-black text-[#ff6700] shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-50 active:scale-95"
              >
                Show all products
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {categoryCards.map((category) => (
              <button
                key={category.label}
                type="button"
                onClick={() => handleCategorySelect(category.category)}
                className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md active:scale-[0.98] ${
                  selectedCategory === category.category
                    ? "border-orange-400 ring-2 ring-orange-200"
                    : "border-orange-100"
                }`}
              >
                <div className="relative h-36 overflow-hidden bg-slate-100">
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={category.label}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full animate-pulse bg-slate-200" />
                  )}
                </div>
                <div className="p-3.5">
                  <p className="font-black text-slate-800">{category.label}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Curated picks and fresh arrivals
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-4 h-8 w-56 animate-pulse rounded-full bg-slate-200" />
            <HomeSkeletonBand />
          </section>
        ) : isEmpty ? (
          <HomeEmptyState />
        ) : (
          <>
            <div ref={productSectionRef} className="scroll-mt-32">
              <ProductSection
                title={
                  selectedCategoryMeta
                    ? `${selectedCategoryMeta.label} Products`
                    : "All Products"
                }
                subtitle="Fresh products from the catalog, ready for quick checkout."
                href={
                  selectedCategory === "all"
                    ? "/shop/products"
                    : `/shop/products?cat=${encodeURIComponent(selectedCategory)}`
                }
                products={categoryFilteredProducts}
                loading={isLoading}
                showEmpty
              />
            </div>
            <ProductSection
              title="Deals of the Day"
              subtitle="Fresh offers with fast delivery and GST invoice support."
              href="/shop/products?sort=price-asc"
              products={deals}
              loading={isLoading}
            />
            <ProductSection
              title="Best Sellers"
              subtitle="High-volume products shoppers trust."
              href="/shop/products?sort=popularity"
              products={bestSellers}
              loading={isLoading}
            />
            <ProductSection
              title="Recently Viewed"
              subtitle="Continue browsing products from your last session."
              href="/shop/products"
              products={recentlyViewed}
              loading={isLoading}
            />
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <Link
                href="/shop/products?sort=price-asc"
                className="group relative min-h-[320px] overflow-hidden rounded-3xl border border-orange-100 bg-white text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
              >
                <Image
                  src="https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=1200&q=85"
                  alt="Premium dry fruits and nuts"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-slate-950/60" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-200">
                    Premium Dry Fruits & Nuts
                  </p>
                  <h2 className="mt-4 text-3xl font-black">
                    Festive pantry upgrades from ₹299.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-orange-50">
                    Almonds, cashews, dates and gourmet mixes with polished
                    gift-ready packaging.
                  </p>
                </div>
              </Link>
              <ProductSection
                title="Premium Dry Fruits & Nuts"
                subtitle="Gift-ready packs and healthy pantry essentials."
                href="/shop/products?cat=premium%20dry%20fruits"
                products={dryFruitProducts}
                loading={isLoading}
              />
            </div>
            <ProductSection
              title="Trending in Electronics"
              subtitle="Phones, audio, wearables and everyday tech upgrades."
              href="/shop/products?cat=electronics"
              products={electronics}
              loading={isLoading}
            />
            <ProductSection
              title="Fashion for You"
              subtitle="Fresh outfits and wardrobe essentials."
              href="/shop/products?cat=fashion"
              products={fashionProducts}
              loading={isLoading}
            />
            <ProductSection
              title="Top Rated"
              subtitle="Products with stronger ratings and review signals."
              href="/shop/products?sort=rating"
              products={topRated}
              loading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

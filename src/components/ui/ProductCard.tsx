"use client";

import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import BaseProductCard from "@/components/ProductCard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart } from "@/features/cart/cartSlice";
import { flyProductImageToCart } from "@/utils/flyToCart";
import { openCartDrawer } from "@/utils/cartDrawerEvents";
import {
  addWishlistItem,
  removeWishlistItem,
  selectWishlistIdSet,
} from "@/features/wishlist/wishlistSlice";
import { toast as sonnerToast } from "sonner";
import { countRender } from "@/lib/perf";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const toRupees = (price: number) => Math.max(1, Math.round(price));
const objectIdPattern = /^[a-f\d]{24}$/i;

function getPricing(product: Product) {
  const hash = Array.from(product.id).reduce(
    (total, char) => total + char.charCodeAt(0),
    0
  );
  const discount = 24 + ((hash * 9) % 46);
  const price = toRupees(product.price);
  const originalPrice = Math.round(price / (1 - discount / 100));
  return { price, originalPrice, discount };
}

function ProductCard({ product }: ProductCardProps) {
  countRender("GridProductCard", { productId: product.id });
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pricing = useMemo(() => getPricing(product), [product]);
  const isLoggedIn = useAppSelector((state) => state.auth.isAuthenticated);
  const authStatus = useAppSelector((state) => state.auth.status);
  const authHydrated = useAppSelector((state) => state.auth.hydrated);
  const role = useAppSelector((state) => state.auth.user?.role);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const backendHydrated = useAppSelector((state) => state.cart.backendHydrated);
  const backendHydratedUserId = useAppSelector(
    (state) => state.cart.backendHydratedUserId
  );

  const wishlistIds = useAppSelector(selectWishlistIdSet);
  const isWishlisted = wishlistIds.has(product.id);

  const handleAddToCart = useCallback(
    async (trigger?: HTMLElement | null) => {
    if (!authHydrated) {
      sonnerToast.info("Loading...");
      return;
    }

    if ((authStatus === "loading" || authStatus === "unknown") && !isLoggedIn) {
      sonnerToast.info("Loading...");
      return;
    }

    if (!isLoggedIn) {
      sonnerToast.info("Sign in to add items to cart.");
      router.push(`/login?next=${encodeURIComponent("/shop/cart")}`);
      return;
    }

    if (role === "admin") {
      sonnerToast.error("Failed");
      router.push("/admin");
      return;
    }

    if (!backendHydrated || backendHydratedUserId !== userId) {
      sonnerToast.info("Loading...");
      return;
    }

    if (!objectIdPattern.test(product.id)) {
      sonnerToast.error("This product is still syncing. Please refresh and try again.");
      return;
    }

    await flyProductImageToCart(trigger);
      dispatch(addToCart(product));
      openCartDrawer(product);
      sonnerToast.success("Success");
    },
    [
      authHydrated,
      authStatus,
      backendHydrated,
      backendHydratedUserId,
      dispatch,
      isLoggedIn,
      product,
      role,
      router,
      userId,
    ]
  );

  const handleWishlist = useCallback(() => {
    if ((authStatus === "loading" || authStatus === "unknown") && !isLoggedIn) {
      sonnerToast.info("Loading...");
      return;
    }

    if (isWishlisted) {
      if (isLoggedIn && objectIdPattern.test(product.id)) {
        void dispatch(removeWishlistItem(product.id));
        sonnerToast.success("Success");
        return;
      }

      sonnerToast.info("Sign in to manage your wishlist.");
      router.push(`/login?next=${encodeURIComponent("/shop/products")}`);
      return;
    }

    if (isLoggedIn) {
      if (!objectIdPattern.test(product.id)) {
        sonnerToast.error("This product is still syncing. Please refresh and try again.");
        return;
      }

      void dispatch(addWishlistItem(product));
      sonnerToast.success("Success");
      return;
    }

    sonnerToast.info("Sign in to manage your wishlist.");
    router.push(`/login?next=${encodeURIComponent("/shop/products")}`);
  }, [authStatus, dispatch, isLoggedIn, isWishlisted, product, router]);

  return (
    <BaseProductCard
      id={product.id}
      name={product.title}
      price={pricing.price}
      originalPrice={pricing.originalPrice}
      discount={pricing.discount}
      image={product.image}
      rating={product.rating?.rate ?? 0}
      reviewCount={product.rating?.count ?? 0}
      category={product.category}
      description={product.description}
      wishlisted={isWishlisted}
      onAddToCart={handleAddToCart}
      onToggleWishlist={handleWishlist}
    />
  );
}

export default memo(ProductCard);

import api from "@/lib/axios";
import {
  toProduct,
  type BackendProduct,
} from "@/features/product/productMapper";
import type { Product } from "@/types/product";

type BackendWishlistProduct = BackendProduct | string;

interface BackendWishlist {
  products?: BackendWishlistProduct[];
}

interface WishlistResponse {
  success: boolean;
  data?: BackendWishlist | null;
}

const isBackendProduct = (
  product: BackendWishlistProduct
): product is BackendProduct => typeof product !== "string";

const normalizeWishlist = (response: WishlistResponse): Product[] => {
  const products = response.data?.products ?? [];

  return products
    .filter(isBackendProduct)
    .map(toProduct)
    .filter((product): product is Product => Boolean(product));
};

export const fetchWishlist = async (): Promise<Product[]> => {
  const response = await api.get<WishlistResponse>("/v1/wishlist");
  return normalizeWishlist(response.data);
};

export const addWishlistProduct = async (
  productId: string
): Promise<Product[]> => {
  await api.post("/v1/wishlist", { productId });
  return fetchWishlist();
};

export const removeWishlistProduct = async (
  productId: string
): Promise<Product[]> => {
  await api.delete(`/v1/wishlist/${productId}`);
  return fetchWishlist();
};

import api from "@/lib/axios";
import type { Product } from "@/types/product";
import {
  normalizeProductsResponse,
  toProduct,
  type BackendProduct,
  type ProductListResult,
  type ProductsResponse,
} from "./productMapper";

const productPageCache = new Map<
  string,
  { data?: ProductListResult; expiresAt: number; pending?: Promise<ProductListResult> }
>();
const productByIdCache = new Map<string, { data: Product; expiresAt: number }>();
const cacheTtlMs = 60_000;

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  keyword?: string;
  category?: string;
  sort?: string;
}

const queryCacheKey = (params: ProductQueryParams) =>
  JSON.stringify({
    page: params.page ?? 1,
    limit: params.limit ?? 24,
    keyword: params.keyword ?? "",
    category: params.category ?? "",
    sort: params.sort ?? "",
  });

export const invalidateProductCache = () => {
  productPageCache.clear();
  productByIdCache.clear();
};

/* ===================== SERVICES ===================== */

/**
 * 📦 Get All Products
 */
export const getProducts = async (): Promise<Product[]> => {
  const result = await getProductPage({ limit: 50 });
  return result.products;
};

export const getProductPage = async (
  params: ProductQueryParams = {}
): Promise<ProductListResult> => {
  const now = Date.now();
  const cacheKey = queryCacheKey(params);
  const cached = productPageCache.get(cacheKey);

  if (cached?.data && cached.expiresAt > now) {
    return cached.data;
  }

  if (cached?.pending) {
    return cached.pending;
  }

  const pending = (async () => {
    try {
      const res = await api.get<ProductsResponse>("/v1/products", {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 24,
          ...(params.keyword ? { keyword: params.keyword } : {}),
          ...(params.category && params.category !== "all"
            ? { category: params.category }
            : {}),
          ...(params.sort ? { sort: params.sort } : {}),
        },
      });
      const result = normalizeProductsResponse(res.data);

      productPageCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + cacheTtlMs,
      });
      return result;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Failed to fetch products from database");
    }
  })();

  productPageCache.set(cacheKey, { pending, expiresAt: now + cacheTtlMs });
  return pending;
};

/**
 * 🔍 Get Product By ID
 */
export const getProductById = async (id: string): Promise<Product> => {
  if (!id) {
    throw new Error("Product ID is required");
  }

  const cached = productByIdCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const res = await api.get<{ success: boolean; data: BackendProduct }>(
      `/v1/products/${id}`
    );

    const product = toProduct(res.data.data);
    if (!product) {
      throw new Error("Product from database is missing an id");
    }
    productByIdCache.set(id, { data: product, expiresAt: Date.now() + cacheTtlMs });
    return product;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch product from database");
  }
};

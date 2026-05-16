import { Suspense } from "react";
import ProductsClient from "./ProductsClient";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  normalizeProductsResponse,
  type ProductListResult,
  type ProductsResponse,
} from "@/features/product/productMapper";

type SearchParams = Record<string, string | string[] | undefined>;

interface ProductsPageProps {
  searchParams?: Promise<SearchParams>;
}

const pageSize = 24;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const sortParam = (sort: string | undefined): string | undefined => {
  if (sort === "price-asc") return "price";
  if (sort === "price-desc") return "-price";
  if (sort === "rating") return "-ratings";
  return undefined;
};

const backendCategory = (category: string | undefined): string | undefined => {
  if (!category || category === "all" || category === "fashion") return undefined;
  if (category === "menswear") return "men's clothing";
  if (category === "womenswear") return "women's clothing";
  return category;
};

async function fetchProducts(
  params: SearchParams
): Promise<ProductListResult & { error?: string }> {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    return {
      products: [],
      total: 0,
      page: 1,
      pages: 1,
      limit: pageSize,
      error: "Product API URL is not configured",
    };
  }

  const page = Math.max(Number(firstValue(params.page)) || 1, 1);
  const category = backendCategory(firstValue(params.cat));
  const keyword = firstValue(params.q)?.trim();
  const sort = sortParam(firstValue(params.sort));
  const url = new URL(`${apiUrl}/v1/products`);

  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(pageSize));
  if (keyword) url.searchParams.set("keyword", keyword);
  if (category) url.searchParams.set("category", category);
  if (sort) url.searchParams.set("sort", sort);

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error("Failed to load products");
    }

    const body = (await response.json()) as ProductsResponse;
    return normalizeProductsResponse(body);
  } catch (error) {
    return {
      products: [],
      total: 0,
      page,
      pages: 1,
      limit: pageSize,
      error:
        error instanceof Error ? error.message : "Failed to load products",
    };
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const result = await fetchProducts(resolvedParams);

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProductsClient
        initialProducts={result.products}
        total={result.total}
        page={result.page}
        pages={result.pages}
        serverError={result.error}
      />
    </Suspense>
  );
}

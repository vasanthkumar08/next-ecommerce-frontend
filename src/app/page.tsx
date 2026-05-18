import HomePage from "@/components/home/HomePage";
import { getApiBaseUrl } from "@/lib/apiUrl";
import {
  normalizeProductsResponse,
  type ProductsResponse,
} from "@/features/product/productMapper";

async function fetchHomeProducts() {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    return {
      products: [],
      error: "Product API URL is not configured",
    };
  }

  const url = new URL(`${apiUrl}/v1/products`);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "50");

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error("Failed to load products");
    }

    const body = (await response.json()) as ProductsResponse;
    return {
      products: normalizeProductsResponse(body).products,
      error: null,
    };
  } catch (error) {
    return {
      products: [],
      error:
        error instanceof Error ? error.message : "Failed to load products",
    };
  }
}

export default async function Page() {
  const { products, error } = await fetchHomeProducts();

  return <HomePage initialProducts={products} initialError={error} />;
}

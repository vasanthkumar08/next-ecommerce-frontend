import type { Product } from "@/types/product";

export interface ProductImage {
  url: string;
  public_id?: string;
}

export interface BackendProduct {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  description: string;
  price: number;
  category: string;
  countInStock?: number;
  stock?: number;
  image?: string;
  images?: ProductImage[];
  ratings?: number;
  rating?: { rate?: number; count?: number };
  numReviews?: number;
}

export interface ProductsResponse {
  success: boolean;
  data:
    | {
        products?: BackendProduct[];
        total?: number;
        page?: number;
        pages?: number;
        limit?: number;
      }
    | BackendProduct[];
  message?: string;
}

export interface ProductListResult {
  products: Product[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

const categoryImages: Record<string, string> = {
  electronics:
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1200&q=80",
  jewelery:
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
  "men's clothing":
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
  "women's clothing":
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
};

const getProductId = (product: BackendProduct) => product.id ?? product._id;

const getProductImage = (product: BackendProduct) => {
  const image = product.images?.[0]?.url ?? product.image;
  if (image?.trim()) return image;

  return (
    categoryImages[product.category?.toLowerCase()] ??
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80"
  );
};

export const toProduct = (product: BackendProduct): Product | null => {
  const id = getProductId(product);

  if (!id) return null;

  return {
    id: String(id),
    title: product.name ?? product.title ?? "Untitled product",
    description: product.description,
    price: product.price,
    image: getProductImage(product),
    category: product.category,
    countInStock: product.countInStock ?? product.stock,
    rating: {
      rate: product.ratings ?? product.rating?.rate ?? 0,
      count: product.numReviews ?? product.rating?.count ?? 0,
    },
  };
};

export const normalizeProductsResponse = (
  response: ProductsResponse
): ProductListResult => {
  const data = response.data;
  const payload = Array.isArray(data)
    ? { products: data, total: data.length, page: 1, pages: 1, limit: data.length }
    : data;

  const products = (payload.products ?? [])
    .map(toProduct)
    .filter((product): product is Product => Boolean(product));

  return {
    products,
    total: payload.total ?? products.length,
    page: payload.page ?? 1,
    pages: payload.pages ?? 1,
    limit: payload.limit ?? products.length,
  };
};

import api from "@/lib/axios";
import type { CartItem } from "./cartSlice";

type BackendProductRef =
  | string
  | {
      _id?: string;
      id?: string;
      name?: string;
      title?: string;
      description?: string;
      price?: number;
      category?: string;
      stock?: number;
      countInStock?: number;
      image?: string;
      images?: Array<{ url?: string }>;
      ratings?: number;
      rating?: { rate?: number; count?: number };
      numReviews?: number;
    };

interface BackendCartResponse {
  data?: {
    items?: BackendCartItem[];
    revision?: number;
    updatedAt?: string;
  };
}

export interface BackendCartState {
  items: CartItem[];
  revision: number;
  updatedAt: string | null;
}

const objectIdPattern = /^[a-f\d]{24}$/i;

interface BackendCartItem {
  product: BackendProductRef;
  quantity: number;
  price?: number;
  name?: string;
  image?: string;
}

const getProductId = (product: BackendProductRef) =>
  typeof product === "string" ? product : product._id ?? product.id ?? "";

const toCartItem = (item: BackendCartItem): CartItem | null => {
  const product = item.product;
  const id = getProductId(product);

  if (!objectIdPattern.test(id)) {
    return null;
  }

  const productData = typeof product === "string" ? null : product;

  return {
    id,
    title: productData?.name ?? productData?.title ?? item.name ?? "Product",
    description: productData?.description ?? "",
    price: productData?.price ?? item.price ?? 0,
    image:
      productData?.images?.[0]?.url ??
      productData?.image ??
      item.image ??
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
    category: productData?.category ?? "general",
    countInStock: productData?.countInStock ?? productData?.stock,
    rating: {
      rate: productData?.ratings ?? productData?.rating?.rate ?? 0,
      count: productData?.numReviews ?? productData?.rating?.count ?? 0,
    },
    quantity: item.quantity,
  };
};

export const fetchBackendCart = async (): Promise<BackendCartState> => {
  const response = await api.get<BackendCartResponse>("/v1/cart");
  const data = response.data.data;
  return {
    items: (data?.items ?? [])
      .map(toCartItem)
      .filter((item): item is CartItem => Boolean(item)),
    revision: data?.revision ?? 0,
    updatedAt: data?.updatedAt ?? null,
  };
};

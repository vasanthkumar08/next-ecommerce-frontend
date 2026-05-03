import axios from "axios";
import { getStoredAccessToken } from "@/features/auth/authStorage";
import { getApiBaseUrl } from "@/lib/apiUrl";
import type { CartItem } from "./cartSlice";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const objectIdPattern = /^[a-f\d]{24}$/i;
type BackendProductRef =
  | string
  | {
      _id?: string;
      id?: string;
    };

interface BackendCartResponse {
  data?: {
    items?: Array<{
      product: BackendProductRef;
      quantity: number;
    }>;
  };
}

const getBackendProductId = (product: BackendProductRef) => {
  if (typeof product === "string") return product;
  return product?._id ?? product?.id ?? "";
};

export function syncCartToBackend(items: CartItem[], isAuthenticated: boolean) {
  if (!isAuthenticated) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    void (async () => {
      try {
        const accessToken = getStoredAccessToken();
        const apiUrl = getApiBaseUrl();

        if (!accessToken || !apiUrl) return;

        const headers = {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        };
        const validItems = items.filter((item) => objectIdPattern.test(item.id));

        const currentCart = await axios.get<BackendCartResponse>(
          `${apiUrl}/v1/cart`,
          {
            headers,
            withCredentials: true,
          }
        );
        const currentItems = new Map(
          (currentCart.data.data?.items ?? []).map((item) => [
            getBackendProductId(item.product),
            item.quantity,
          ])
        );
        const desiredItems = new Map(
          validItems.map((item) => [item.id, item.quantity])
        );

        await Promise.all([
          ...validItems.map((item) => {
            const payload = {
              productId: item.id,
              quantity: item.quantity,
            };
            const existingQuantity = currentItems.get(item.id);

            if (existingQuantity === undefined) {
              return axios.post(`${apiUrl}/v1/cart/items`, payload, {
                headers,
                withCredentials: true,
              });
            }

            if (existingQuantity !== item.quantity) {
              return axios.put(`${apiUrl}/v1/cart/items`, payload, {
                headers,
                withCredentials: true,
              });
            }

            return Promise.resolve();
          }),
          ...[...currentItems.keys()]
            .filter((productId) => productId && !desiredItems.has(productId))
            .map((productId) =>
              axios.delete(`${apiUrl}/v1/cart/items/${productId}`, {
                headers,
                withCredentials: true,
              })
            ),
        ]);
      } catch {
        // Local cart remains the source of truth if backend sync is unavailable.
      }
    })();
  }, 400);
}

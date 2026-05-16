import api from "@/lib/axios";
import { getCsrfToken } from "@/features/auth/authStorage";
import type { CartItem } from "./cartSlice";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncPaused = false;
let suppressedSnapshotKey: string | null = null;
let baseProductIds: Set<string> | null = null;
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

const getSnapshotKey = (items: CartItem[]): string =>
  items
    .filter((item) => objectIdPattern.test(item.id))
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join("|");

export async function syncCartToBackendNow(
  items: CartItem[],
  isAuthenticated: boolean
): Promise<boolean> {
  if (!isAuthenticated) return false;

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken() as string } : {}),
    };
    const validItems = items.filter((item) => objectIdPattern.test(item.id));

    const currentCart = await api.get<BackendCartResponse>("/v1/cart", {
      headers,
    });
    const currentItems = new Map(
      (currentCart.data.data?.items ?? []).map((item) => [
        getBackendProductId(item.product),
        item.quantity,
      ])
    );
    const desiredItems = new Map(
      validItems.map((item) => [item.id, item.quantity])
    );
    const deletableProductIds =
      baseProductIds ?? new Set([...currentItems.keys()]);

    await Promise.all([
      ...validItems.map((item) => {
        const payload = {
          productId: item.id,
          quantity: item.quantity,
        };
        const existingQuantity = currentItems.get(item.id);

        if (existingQuantity === undefined) {
          return api.post("/v1/cart/items", payload, {
            headers,
          });
        }

        if (existingQuantity !== item.quantity) {
          return api.put("/v1/cart/items", payload, {
            headers,
          });
        }

        return Promise.resolve();
      }),
      ...[...currentItems.keys()]
        .filter(
          (productId) =>
            productId &&
            !desiredItems.has(productId) &&
            deletableProductIds.has(productId)
        )
        .map((productId) =>
          api.delete(`/v1/cart/items/${productId}`, {
            headers,
          })
        ),
    ]);

    baseProductIds = new Set(validItems.map((item) => item.id));
    return true;
  } catch {
    // Local cart remains available if backend sync is unavailable.
    return false;
  }
}

export function syncCartToBackend(items: CartItem[], isAuthenticated: boolean) {
  if (syncPaused) return;
  if (!isAuthenticated) return;

  const snapshotKey = getSnapshotKey(items);

  if (suppressedSnapshotKey && suppressedSnapshotKey === snapshotKey) {
    suppressedSnapshotKey = null;
    return;
  }

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    void (async () => {
      await syncCartToBackendNow(items, isAuthenticated);
    })();
  }, 400);
}

export function pauseCartSync(): void {
  // Logout invalidates the session, not the user's persistent cart. Any queued
  // sync using the soon-to-be-revoked cookies must be cancelled so an empty or
  // guest cart cannot overwrite the server-side user cart.
  syncPaused = true;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

export function resumeCartSync(): void {
  syncPaused = false;
}

export function suppressNextCartSync(items: CartItem[]): void {
  suppressedSnapshotKey = getSnapshotKey(items);
}

export function setCartSyncBase(items: CartItem[]): void {
  baseProductIds = new Set(
    items.filter((item) => objectIdPattern.test(item.id)).map((item) => item.id)
  );
}

export function isCartSyncPaused(): boolean {
  return syncPaused;
}

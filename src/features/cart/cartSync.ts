import api from "@/lib/axios";
import { getCsrfToken } from "@/features/auth/authStorage";
import type { CartItem } from "./cartSlice";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncPaused = false;
let syncInFlight = false;
let suppressedSnapshotKey: string | null = null;
let baseProductIds: Set<string> | null = null;
let baseQuantities: Map<string, number> | null = null;
let baseRevision: number | null = null;
const objectIdPattern = /^[a-f\d]{24}$/i;
const cartHydrationRetryEvent = "vasanthtrends:cart-hydration-retry";
type BackendProductRef =
  | string
  | {
      _id?: string;
      id?: string;
    };

interface BackendCartResponse {
  data?: {
    revision?: number;
    updatedAt?: string;
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

const isCartVersionConflict = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as {
    response?: { status?: number; data?: { code?: string; error?: { code?: string } } };
  };

  return (
    maybeError.response?.status === 409 &&
    (maybeError.response?.data?.code === "CART_VERSION_CONFLICT" ||
      maybeError.response?.data?.error?.code === "CART_VERSION_CONFLICT")
  );
};

const requestCanonicalCartHydration = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(cartHydrationRetryEvent));
  }
};

export async function syncCartToBackendNow(
  items: CartItem[],
  isAuthenticated: boolean
): Promise<boolean> {
  if (!isAuthenticated) return false;
  syncInFlight = true;

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken() as string } : {}),
    };
    const validItems = items.filter((item) => objectIdPattern.test(item.id));

    const currentCart = await api.get<BackendCartResponse>("/v1/cart", {
      headers,
    });
    const currentRevision = currentCart.data.data?.revision ?? 0;

    if (baseRevision !== null && currentRevision !== baseRevision) {
      const refreshedItems = new Map(
        (currentCart.data.data?.items ?? []).map((item) => [
          getBackendProductId(item.product),
          item.quantity,
        ])
      );
      baseProductIds = new Set([...refreshedItems.keys()]);
      baseQuantities = refreshedItems;
      baseRevision = currentRevision;
      requestCanonicalCartHydration();
      return false;
    }

    let nextRevision = currentRevision;
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
    let conflictSkipped = false;

    for (const item of validItems) {
        const payload = {
          productId: item.id,
          quantity: item.quantity,
          revision: nextRevision,
        };
        const existingQuantity = currentItems.get(item.id);

        if (existingQuantity === undefined) {
          const response = await api.post<BackendCartResponse>("/v1/cart/items", payload, {
            headers: { ...headers, "If-Match": String(nextRevision) },
          });
          nextRevision = response.data.data?.revision ?? nextRevision + 1;
          continue;
        }

        if (existingQuantity !== item.quantity) {
          const baseQuantity = baseQuantities?.get(item.id);

          if (baseQuantity !== undefined && existingQuantity !== baseQuantity) {
            conflictSkipped = true;
            continue;
          }

          if (baseQuantity === undefined && baseProductIds !== null) {
            conflictSkipped = true;
            continue;
          }

          const response = await api.put<BackendCartResponse>("/v1/cart/items", payload, {
            headers: { ...headers, "If-Match": String(nextRevision) },
          });
          nextRevision = response.data.data?.revision ?? nextRevision + 1;
        }
    }

    for (const productId of [...currentItems.keys()]
        .filter(
          (productId) =>
            productId &&
            !desiredItems.has(productId) &&
            deletableProductIds.has(productId)
        )) {
      const response = await api.delete<BackendCartResponse>(
        `/v1/cart/items/${productId}`,
        {
          headers: { ...headers, "If-Match": String(nextRevision) },
          data: { revision: nextRevision },
        }
      );
      nextRevision = response.data.data?.revision ?? nextRevision + 1;
    }

    if (conflictSkipped) {
      const refreshedCart = await api.get<BackendCartResponse>("/v1/cart", {
        headers,
      });
      const refreshedItems = new Map(
        (refreshedCart.data.data?.items ?? []).map((item) => [
          getBackendProductId(item.product),
          item.quantity,
        ])
      );
      baseProductIds = new Set([...refreshedItems.keys()]);
      baseQuantities = refreshedItems;
      baseRevision = refreshedCart.data.data?.revision ?? null;
      requestCanonicalCartHydration();
      return false;
    }

    baseProductIds = new Set(validItems.map((item) => item.id));
    baseQuantities = new Map(validItems.map((item) => [item.id, item.quantity]));
    baseRevision = nextRevision;
    return true;
  } catch (error) {
    if (isCartVersionConflict(error)) {
      requestCanonicalCartHydration();
    }
    // Local cart remains available if backend sync is unavailable.
    return false;
  } finally {
    syncInFlight = false;
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
    syncTimer = null;
  }

  void syncCartToBackendNow(items, isAuthenticated);
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

export function setCartSyncBase(items: CartItem[], revision: number | null = null): void {
  const validItems = items.filter((item) => objectIdPattern.test(item.id));
  baseProductIds = new Set(validItems.map((item) => item.id));
  baseQuantities = new Map(validItems.map((item) => [item.id, item.quantity]));
  baseRevision = revision;
}

export function isCartSyncPaused(): boolean {
  return syncPaused;
}

export function isCartSyncInFlight(): boolean {
  return syncInFlight;
}

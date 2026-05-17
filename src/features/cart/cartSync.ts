import api from "@/lib/axios";
import { getCsrfToken } from "@/features/auth/authStorage";
import type { CartItem } from "./cartSlice";
import { clearPendingCartSync, savePendingCartSync } from "./cartPersist";
import { fetchBackendCart } from "./cartBackend";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncPaused = false;
let syncInFlight = false;
let pendingSnapshot: { items: CartItem[]; isAuthenticated: boolean } | null = null;
let dirtySnapshotKey: string | null = null;
let suppressedSnapshotKey: string | null = null;
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

const rebaseLocalChangesOnRemoteCart = (
  localItems: CartItem[],
  remoteItems: CartItem[]
): CartItem[] => {
  const localById = new Map(
    localItems
      .filter((item) => objectIdPattern.test(item.id))
      .map((item) => [item.id, item])
  );
  const remoteById = new Map(
    remoteItems
      .filter((item) => objectIdPattern.test(item.id))
      .map((item) => [item.id, item])
  );
  const baseById = baseQuantities ?? new Map<string, number>();
  const merged = new Map<string, CartItem>();
  const productIds = new Set([
    ...baseById.keys(),
    ...remoteById.keys(),
    ...localById.keys(),
  ]);

  productIds.forEach((productId) => {
    const localItem = localById.get(productId);
    const remoteItem = remoteById.get(productId);
    const baseQuantity = baseById.get(productId) ?? 0;
    const localQuantity = localItem?.quantity ?? 0;
    const remoteQuantity = remoteItem?.quantity ?? 0;
    const localChanged = localQuantity !== baseQuantity;
    const quantity = localChanged ? localQuantity : remoteQuantity;
    const item = localChanged ? localItem : remoteItem;

    if (!item || quantity <= 0) return;
    merged.set(productId, { ...item, quantity });
  });

  return Array.from(merged.values());
};

const isCartVersionConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;

  const maybeError = error as {
    response?: {
      status?: number;
      data?: {
        code?: string;
        error?: {
          code?: string;
        };
      };
    };
  };

  return (
    maybeError.response?.status === 409 ||
    maybeError.response?.data?.code === "CART_VERSION_CONFLICT" ||
    maybeError.response?.data?.error?.code === "CART_VERSION_CONFLICT"
  );
};

const requestCanonicalCartHydration = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(cartHydrationRetryEvent));
  }
};

export async function syncCartToBackendNow(
  items: CartItem[],
  isAuthenticated: boolean,
  userId?: string | null
): Promise<boolean> {
  if (!isAuthenticated) return false;
  pendingSnapshot = {
    items: items.map((item) => ({ ...item })),
    isAuthenticated,
  };
  dirtySnapshotKey = getSnapshotKey(items);
  savePendingCartSync(items, userId);

  if (syncInFlight) return false;

  syncInFlight = true;
  let synced = false;

  try {
    while (pendingSnapshot) {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;

      if (!snapshot.isAuthenticated) continue;

      let validItems = snapshot.items.filter((item) =>
        objectIdPattern.test(item.id)
      );
      const headers = {
        "Content-Type": "application/json",
        ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken() as string } : {}),
      };

      const remoteCart = await fetchBackendCart();
      let revision = remoteCart.revision;

      if (baseRevision === null || remoteCart.revision !== baseRevision) {
        validItems = rebaseLocalChangesOnRemoteCart(validItems, remoteCart.items);
      }

      let response;

      try {
        response = await api.put<BackendCartResponse>(
          "/v1/cart",
          {
            revision,
            items: validItems.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
            })),
          },
          { headers }
        );
      } catch (error) {
        if (!isCartVersionConflict(error)) {
          throw error;
        }

        const latestCart = await fetchBackendCart();
        revision = latestCart.revision;
        validItems = rebaseLocalChangesOnRemoteCart(validItems, latestCart.items);

        response = await api.put<BackendCartResponse>(
          "/v1/cart",
          {
            revision,
            items: validItems.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
            })),
          },
          { headers }
        );
      }

      const savedItems = response.data.data?.items ?? [];
      const savedQuantities = new Map(
        savedItems.map((item) => [
          getBackendProductId(item.product),
          item.quantity,
        ])
      );

      baseQuantities = savedQuantities;
      baseRevision = response.data.data?.revision ?? null;
      dirtySnapshotKey = null;
      clearPendingCartSync(userId);
      if (getSnapshotKey(validItems) !== getSnapshotKey(snapshot.items)) {
        requestCanonicalCartHydration();
      }
      synced = true;
    }

    return synced;
  } catch {
    requestCanonicalCartHydration();
    return false;
  } finally {
    syncInFlight = false;
  }
}

export function syncCartToBackend(
  items: CartItem[],
  isAuthenticated: boolean,
  userId?: string | null
) {
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

  void syncCartToBackendNow(items, isAuthenticated, userId);
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
  baseQuantities = new Map(validItems.map((item) => [item.id, item.quantity]));
  baseRevision = revision;
  dirtySnapshotKey = null;
}

export function isCartSyncPaused(): boolean {
  return syncPaused;
}

export function isCartSyncInFlight(): boolean {
  return syncInFlight;
}

export function hasPendingCartSync(): boolean {
  return Boolean(dirtySnapshotKey || pendingSnapshot || syncInFlight);
}

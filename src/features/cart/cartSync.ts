import api from "@/lib/axios";
import type { CartItem } from "./cartSlice";

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function syncCartToBackend(items: CartItem[], isAuthenticated: boolean) {
  if (!isAuthenticated) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    void (async () => {
      try {
        await api.delete("/v1/cart");

        await Promise.all(
          items.map((item) =>
            api.post("/v1/cart/items", {
              productId: item.id,
              quantity: item.quantity,
            })
          )
        );
      } catch {
        // Local cart remains the source of truth if backend sync is unavailable.
      }
    })();
  }, 400);
}

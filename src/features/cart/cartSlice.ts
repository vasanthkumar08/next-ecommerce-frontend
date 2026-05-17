import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Product } from "@/types/product";

export interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  items: CartItem[];
  hydrated: boolean;
  backendHydrated: boolean;
  backendHydratedUserId: string | null;
  backendHydratedAt: number | null;
  backendRevision: number | null;
  backendUpdatedAt: string | null;
  backendHydrationError: string | null;
}

const initialState: CartState = {
  items: [],
  hydrated: false,
  backendHydrated: false,
  backendHydratedUserId: null,
  backendHydratedAt: null,
  backendRevision: null,
  backendUpdatedAt: null,
  backendHydrationError: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Product>) => {
      const existing = state.items.find((item) => item.id === action.payload.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },

    // ✅ FIX: was PayloadAction<string> with Number() coercion — now consistently number
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },

    decreaseQuantity: (state, action: PayloadAction<string>) => {
      const existing = state.items.find((item) => item.id === action.payload);
      if (!existing) return;
      if (existing.quantity <= 1) {
        state.items = state.items.filter((item) => item.id !== action.payload);
      } else {
        existing.quantity -= 1;
      }
    },

    clearCart: (state) => {
      state.items = [];
    },

    hydrateCart: (state, action: PayloadAction<CartItem[] | undefined>) => {
      state.items = action.payload ?? [];
      state.hydrated = true;
    },

    hydrateBackendCart: (
      state,
      action: PayloadAction<{
        items: CartItem[];
        userId: string;
        hydratedAt?: number;
        revision?: number | null;
        updatedAt?: string | null;
      }>
    ) => {
      state.items = action.payload.items;
      state.hydrated = true;
      state.backendHydrated = true;
      state.backendHydratedUserId = action.payload.userId;
      state.backendHydratedAt = action.payload.hydratedAt ?? Date.now();
      state.backendRevision = action.payload.revision ?? null;
      state.backendUpdatedAt = action.payload.updatedAt ?? null;
      state.backendHydrationError = null;
    },

    markBackendCartHydrationPending: (state) => {
      state.backendHydrated = false;
      state.backendHydratedUserId = null;
      state.backendHydratedAt = null;
      state.backendRevision = null;
      state.backendUpdatedAt = null;
      state.backendHydrationError = null;
    },

    markBackendCartHydrationFailed: (
      state,
      action: PayloadAction<string | undefined>
    ) => {
      state.backendHydrated = false;
      state.backendHydratedUserId = null;
      state.backendHydratedAt = null;
      state.backendRevision = null;
      state.backendUpdatedAt = null;
      state.backendHydrationError =
        action.payload ?? "Backend cart could not be loaded";
    },

    resetBackendCartHydration: (state) => {
      state.backendHydrated = false;
      state.backendHydratedUserId = null;
      state.backendHydratedAt = null;
      state.backendRevision = null;
      state.backendUpdatedAt = null;
      state.backendHydrationError = null;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  decreaseQuantity,
  clearCart,
  hydrateCart,
  hydrateBackendCart,
  markBackendCartHydrationFailed,
  markBackendCartHydrationPending,
  resetBackendCartHydration,
} = cartSlice.actions;
export default cartSlice.reducer;

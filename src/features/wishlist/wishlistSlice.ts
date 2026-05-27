import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import { Product } from "@/types/product";
import {
  addWishlistProduct,
  fetchWishlist,
  removeWishlistProduct,
} from "./wishlist.api";

interface WishlistState {
  items: Product[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
}

const initialState: WishlistState = {
  items: [],
  loading: false,
  error: null,
  hydrated: false,
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Wishlist request failed";

export const hydrateWishlist = createAsyncThunk(
  "wishlist/hydrate",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchWishlist();
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  }
);

export const addWishlistItem = createAsyncThunk(
  "wishlist/addItem",
  async (product: Product, { rejectWithValue }) => {
    try {
      return await addWishlistProduct(product.id);
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  }
);

export const removeWishlistItem = createAsyncThunk(
  "wishlist/removeItem",
  async (productId: string, { rejectWithValue }) => {
    try {
      return await removeWishlistProduct(productId);
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  }
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    addToWishlist: () => {
      // Guest/device-local wishlist ownership is disabled. Authenticated
      // wishlist changes must go through backend-protected thunks.
    },
    removeFromWishlist: () => {
      // Guest/device-local wishlist ownership is disabled.
    },
    clearWishlist: (state) => {
      state.items = [];
      state.hydrated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateWishlist.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
        state.hydrated = true;
      })
      .addCase(hydrateWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Wishlist request failed";
      })
      .addCase(addWishlistItem.fulfilled, (state, action) => {
        state.items = action.payload;
        state.hydrated = true;
      })
      .addCase(removeWishlistItem.fulfilled, (state, action) => {
        state.items = action.payload;
        state.hydrated = true;
      });
  },
});

export const { addToWishlist, removeFromWishlist, clearWishlist } =
  wishlistSlice.actions;
type WishlistRootState = { wishlist: WishlistState };

export const selectWishlistItems = (state: WishlistRootState) => state.wishlist.items;
export const selectWishlistIdSet = createSelector(
  [selectWishlistItems],
  (items) => new Set(items.map((item) => item.id))
);
export default wishlistSlice.reducer;

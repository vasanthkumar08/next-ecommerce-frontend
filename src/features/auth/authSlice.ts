import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  AuthResponse,
  RegisterResponse,
  User,
  loginUser,
  registerUser,
} from "./auth.api";
import {
  clearAuthSession,
  persistAuthSession,
} from "./authStorage";
import { markPerf, measurePerf } from "@/lib/perf";
import { pauseCartSync, resumeCartSync } from "@/features/cart/cartSync";

// ✅ Define ONCE — all thunks in this file inherit rejectValue: string
const createAuthThunk = createAsyncThunk.withTypes<{
  rejectValue: string;
}>();

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: "loading" | "authenticated" | "guest" | "unknown";
  loading: boolean;
  logoutLoading: boolean;
  hydrated: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: "loading",
  loading: false,
  logoutLoading: false,
  hydrated: false,
  error: null,
  isAuthenticated: false,
};

export const login = createAuthThunk(
  "auth/login",
  async (
    data: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const result: AuthResponse = await loginUser(data);
      persistAuthSession(
        result.accessToken,
        result.user,
        result.csrfToken
      );
      resumeCartSync();
      return result;
    } catch (err: unknown) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Login failed"
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as {
        auth?: Pick<AuthState, "loading" | "isAuthenticated">;
      };

      if (state.auth?.loading === true) {
        if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
          console.info("auth_login", {
            event: "duplicate_thunk_ignored",
            reason: "login_already_pending",
          });
        }

        return false;
      }

      return true;
    },
  }
);

export const register = createAuthThunk(
  "auth/register",
  async (
    data: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const result: RegisterResponse = await registerUser(data);
      return result;
    } catch (err: unknown) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Registration failed"
      );
    }
  }
);

export const logout = createAuthThunk(
  "auth/logout",
  async (source: string | undefined, { getState, rejectWithValue }) => {
    try {
      const state = getState() as {
        auth?: Pick<
          AuthState,
          "hydrated" | "isAuthenticated" | "logoutLoading" | "user"
        >;
      };

      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.info("auth_logout", {
          event: "thunk_started",
          source: source ?? "redux",
          hydrated: state.auth?.hydrated ?? false,
          isAuthenticated: state.auth?.isAuthenticated ?? false,
          logoutLoading: state.auth?.logoutLoading ?? false,
          userId: state.auth?.user?.id ?? null,
        });
      }

      pauseCartSync();
      markPerf("logout:cart-sync-paused", { source: source ?? "redux" });
      measurePerf(
        "logout:click-to-cart-sync-pause",
        "logout:click",
        "logout:cart-sync-paused",
        { source: source ?? "redux" }
      );

      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.info("auth_logout", {
          event: "cart_sync_paused",
          source: source ?? "redux",
        });
      }

      await clearAuthSession(source ?? "redux");
    } catch (err: unknown) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Logout failed"
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as {
        auth?: Pick<AuthState, "logoutLoading" | "isAuthenticated" | "hydrated">;
      };

      if (state.auth?.logoutLoading === true) return false;
      if (state.auth?.hydrated === true && state.auth.isAuthenticated === false) {
        return false;
      }

      return true;
    },
  }
);

const clearAuthState = (state: AuthState) => {
  state.user = null;
  state.accessToken = null;
  state.isAuthenticated = false;
  state.status = "guest";
  state.hydrated = true;
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth: (
      state,
      action: {
        payload: {
          user: User | null;
          accessToken: string | null;
        };
      }
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = Boolean(
        action.payload.user && action.payload.accessToken
      );
      state.status = state.isAuthenticated ? "authenticated" : "guest";
      state.hydrated = true;
    },
    markAuthUnknown: (state) => {
      state.status = "unknown";
      state.hydrated = true;
      // Unknown means the browser could not currently verify the backend
      // session, often because mobile/cross-site cookies are still settling.
      // Preserve the last known user so cart/order ownership does not fall back
      // to guest and split data across devices.
      state.isAuthenticated = Boolean(state.user && state.accessToken);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.isAuthenticated = true;
        state.status = "authenticated";
        state.hydrated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.status = "guest";
        state.error = action.payload ?? "Login failed";
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Registration failed";
      })
      .addCase(logout.pending, (state) => {
        state.logoutLoading = true;
        state.error = null;
        clearAuthState(state);
      })
      .addCase(logout.fulfilled, (state) => {
        state.logoutLoading = false;
        clearAuthState(state);
      })
      .addCase(logout.rejected, (state, action) => {
        state.logoutLoading = false;
        clearAuthState(state);
        state.error = action.payload ?? null;
      });
  },
});

export const { hydrateAuth, markAuthUnknown } = authSlice.actions;
export default authSlice.reducer;

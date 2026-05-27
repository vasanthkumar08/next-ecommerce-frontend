import api from "@/lib/axios";
import axios from "axios";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  User,
} from "./authTypes";

/**
 * 👤 Types
 */
export type { AuthResponse, LoginRequest, RegisterRequest, RegisterResponse, User };

interface ApiErrorBody {
  message?: string;
  retryAfter?: number;
}

/**
 * 🔐 LOGIN
 */
export const loginUser = async (
  data: LoginRequest
): Promise<AuthResponse> => {
  try {
    const res = await api.post<AuthResponse>("/v1/auth/login", data);

    return res.data;
  } catch (error) {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      const status = error.response?.status;

      if (status === 401) {
        throw new Error("Invalid email or password");
      }

      if (status === 403) {
        throw new Error(error.response?.data?.message ?? "Login blocked");
      }

      if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter;
        throw new Error(
          retryAfter
            ? `Too many login attempts. Try again in ${retryAfter} seconds.`
            : "Too many login attempts. Please wait and try again."
        );
      }

      if (status && ![404, 500, 502, 503, 504].includes(status)) {
        throw new Error(error.response?.data?.message ?? "Login failed");
      }

      if (error.code === "ERR_NETWORK") {
        throw new Error("Network or CORS error. Please try again.");
      }
    }

    throw new Error("Login failed");
  }
};

/**
 * 📝 REGISTER
 */
export const registerUser = async (
  data: RegisterRequest
): Promise<RegisterResponse> => {
  try {
    const res = await api.post<RegisterResponse>("/v1/auth/register", data);
    return res.data;
  } catch (error) {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      const status = error.response?.status;

      if (status === 429) {
        const retryAfter = error.response?.data?.retryAfter;
        throw new Error(
          retryAfter
            ? `Too many registration attempts. Try again in ${retryAfter} seconds.`
            : "Too many registration attempts. Please wait and try again."
        );
      }

      if (status && ![404, 500, 502, 503, 504].includes(status)) {
        throw new Error(error.response?.data?.message ?? "Registration failed");
      }
    }

    throw new Error("Registration failed");
  }
};

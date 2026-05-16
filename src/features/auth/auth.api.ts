import api from "@/lib/axios";
import axios from "axios";

/**
 * 👤 Types
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "manager";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user: User;
  accessToken: string;
  csrfToken?: string;
}

interface ApiErrorBody {
  message?: string;
  retryAfter?: number;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: User;
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
    if (axios.isAxiosError<{ message?: string }>(error)) {
      const status = error.response?.status;

      if (status && ![404, 500, 502, 503, 504].includes(status)) {
        throw new Error(error.response?.data?.message ?? "Registration failed");
      }
    }

    throw new Error("Registration failed");
  }
};

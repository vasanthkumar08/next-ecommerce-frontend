import api from "@/lib/axios";
import { invalidateProductCache } from "@/features/product/product.api";
import type {
  ApiResponse,
  DashboardStats,
  AdminProduct,
  PaginatedOrders,
  PaginatedProducts,
  PaginatedUsers,
} from "@/types/admin";
import type { Role } from "@/types/rbac";

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  discount: number;
  category: string;
  brand?: string;
  images: Array<{ url: string; public_id: string }>;
  stock: number;
  countInStock?: number;
  sku?: string;
  ratings?: number;
}

interface ProductsApiData {
  products?: AdminProduct[];
  total?: number;
  page?: number;
  pages?: number;
}

function normalizeProducts(
  data: ProductsApiData | AdminProduct[]
): PaginatedProducts {
  if (Array.isArray(data)) {
    return {
      products: data,
      total: data.length,
      page: 1,
      pages: 1,
    };
  }

  const products = data.products ?? [];

  return {
    products,
    total: data.total ?? products.length,
    page: data.page ?? 1,
    pages: data.pages ?? 1,
  };
}

export async function fetchDashboardStats() {
  const response = await api.get<ApiResponse<DashboardStats>>(
    "/v1/admin/dashboard/stats"
  );
  return response.data.data;
}

export async function fetchAdminProducts(params?: {
  page?: number;
  keyword?: string;
  limit?: number;
  category?: string;
}) {
  const response = await api.get<ApiResponse<ProductsApiData | AdminProduct[]>>(
    "/v1/products",
    { params }
  );
  return normalizeProducts(response.data.data);
}

export async function createAdminProduct(payload: ProductPayload) {
  const response = await api.post<ApiResponse<AdminProduct>>(
    "/v1/products",
    payload
  );
  invalidateProductCache();
  return response.data.data;
}

export async function updateAdminProduct(id: string, payload: ProductPayload) {
  const response = await api.put<ApiResponse<AdminProduct>>(
    `/v1/products/${id}`,
    payload
  );
  invalidateProductCache();
  return response.data.data;
}

export async function deleteAdminProduct(id: string) {
  const response = await api.delete<ApiResponse<null>>(`/v1/products/${id}`);
  invalidateProductCache();
  return response.data;
}

export async function fetchAdminOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const response = await api.get<ApiResponse<PaginatedOrders>>(
    "/v1/admin/orders",
    { params }
  );
  return response.data.data;
}

export async function updateAdminOrderStatus(id: string, status: string) {
  const response = await api.patch<ApiResponse<unknown>>(
    `/v1/admin/orders/${id}/status`,
    { status }
  );
  return response.data;
}

export async function deleteAdminOrder(id: string) {
  const response = await api.delete<ApiResponse<{ id: string }>>(
    `/v1/admin/orders/${id}`
  );
  return response.data;
}

export async function fetchAdminUsers(params?: {
  page?: number;
  search?: string;
  limit?: number;
}) {
  const response = await api.get<ApiResponse<PaginatedUsers>>(
    "/v1/admin/users",
    { params }
  );
  return response.data.data;
}

export async function setAdminUserBlocked(id: string, isBlocked: boolean) {
  const response = await api.patch<ApiResponse<unknown>>(
    `/v1/admin/users/${id}/block`,
    { isBlocked }
  );
  return response.data;
}

export async function setAdminUserRole(id: string, role: Role) {
  const response = await api.patch<ApiResponse<unknown>>(
    `/v1/admin/users/${id}/role`,
    { role }
  );
  return response.data;
}

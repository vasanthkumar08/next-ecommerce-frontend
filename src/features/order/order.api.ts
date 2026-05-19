import api from "@/lib/axios";
import axios from "axios";
import { CartItem } from "@/features/cart/cartSlice";
import type { Order } from "@/features/orders/ordersSlice";

export type PaymentMethod = "cod" | "credit_card" | "debit_card" | "upi";

export interface ShippingAddress {
  name?: string;
  address: string;
  phone?: string;
  alternatePhone?: string;
  houseNumber?: string;
  apartment?: string;
  street?: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode: string;
  country: string;
  addressType?: "Home" | "Work" | "Office" | "Other";
}

const objectIdPattern = /^[a-f\d]{24}$/i;
const checkoutAttemptPrefix = "smarttrens:checkout-attempt:";

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const createCheckoutIdempotencyKey = (
  items: CartItem[],
  shippingAddress: ShippingAddress,
  paymentMethod: PaymentMethod
) => {
  const cartFingerprint = items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join("|");
  const addressFingerprint = [
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.pincode,
    shippingAddress.country,
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");

  return `checkout:${paymentMethod}:${stableHash(
    `${cartFingerprint}:${addressFingerprint}`
  )}`;
};

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const checkoutAttemptStorageKey = (fingerprint: string) =>
  `${checkoutAttemptPrefix}${fingerprint}`;

const getCheckoutAttemptKey = (fingerprint: string) => {
  if (typeof window === "undefined") return `${fingerprint}:${randomId()}`;

  const storageKey = checkoutAttemptStorageKey(fingerprint);
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const next = `${fingerprint}:${randomId()}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
};

export const clearCheckoutAttemptKey = (fingerprint: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(checkoutAttemptStorageKey(fingerprint));
};

export const getCheckoutFingerprint = (
  items: CartItem[],
  shippingAddress: ShippingAddress,
  paymentMethod: PaymentMethod
) => createCheckoutIdempotencyKey(items, shippingAddress, paymentMethod);

interface CreateOrderResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    items: Array<{
      productId?: string;
      name: string;
      quantity: number;
      price: number;
      image?: string;
    }>;
    totalAmount: number;
    status: string;
    paymentInfo?: {
      method?: PaymentMethod;
    };
    createdAt: string;
  };
}

interface BackendOrder {
  id: string;
  createdAt: string;
  status?: Order["status"];
  items?: Array<{
    productId?: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  totalAmount?: number;
  totalPrice?: number;
  paymentInfo?: { method?: string };
  isPaid?: boolean;
  isDelivered?: boolean;
}

const toOrder = (order: BackendOrder, userId?: string): Order => ({
  id: order.id,
  createdAt: order.createdAt,
  status: normalizeOrderStatus(order.status, order.isDelivered),
  items: (order.items ?? []).map((item) => ({
    productId: item.productId ?? item.name,
    title: item.name,
    price: item.price,
    quantity: item.quantity,
    image: item.image,
  })),
  total: order.totalAmount ?? order.totalPrice ?? 0,
  paymentMethod: order.paymentInfo?.method,
  isPaid: order.isPaid,
  isDelivered: order.isDelivered,
  userId,
});

export const createOrder = async (
  items: CartItem[],
  total: number,
  shippingAddress: ShippingAddress,
  paymentMethod: PaymentMethod,
  userId?: string
): Promise<Order> => {
  const invalidItem = items.find((item) => !objectIdPattern.test(item.id));

  if (invalidItem) {
    throw new Error(
      `${invalidItem.title} is no longer available. Remove it from cart and add it again.`
    );
  }

  let res;

  const checkoutFingerprint = createCheckoutIdempotencyKey(
    items,
    shippingAddress,
    paymentMethod
  );
  const idempotencyKey = getCheckoutAttemptKey(checkoutFingerprint);

  try {
    res = await api.post<CreateOrderResponse>("/v1/orders", {
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      totalAmount: total,
      idempotencyKey,
      shippingAddress,
      paymentMethod,
    }, {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });
  } catch (error) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      throw new Error(error.response?.data?.message ?? "Order could not be placed");
    }

    throw error;
  }

  return {
    id: res.data.data.id,
    createdAt: res.data.data.createdAt,
    status: "Pending",
    items: res.data.data.items.map((item) => ({
      productId: item.productId ?? item.name,
      title: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    })),
    total: res.data.data.totalAmount,
    paymentMethod: res.data.data.paymentInfo?.method ?? paymentMethod,
    userId,
    isPaid: paymentMethod !== "cod",
  };
};

export const fetchOrders = async (userId?: string): Promise<Order[]> => {
  const res = await api.get<{
    success: boolean;
    data:
      | {
          orders?: BackendOrder[];
        }
      | BackendOrder[];
  }>("/v1/orders");

  const orders = Array.isArray(res.data.data)
    ? res.data.data
    : res.data.data.orders ?? [];

  return orders.map((order) => toOrder(order, userId));
};

export const fetchOrderById = async (
  id: string,
  userId?: string
): Promise<Order> => {
  const res = await api.get<{
    success: boolean;
    data: BackendOrder;
  }>(`/v1/orders/${id}`);

  return toOrder(res.data.data, userId);
};

const normalizeOrderStatus = (
  status: Order["status"] | string | undefined,
  isDelivered?: boolean
): Order["status"] => {
  if (isDelivered) {
    return "Delivered";
  }

  const normalized = String(status ?? "Pending").toLowerCase();
  const map: Record<string, Order["status"]> = {
    pending: "Pending",
    confirmed: "Pending",
    paid: "Processing",
    processing: "Processing",
    shipped: "Shipped",
    out_for_delivery: "Shipped",
    delivered: "Delivered",
    completed: "Delivered",
    cancelled: "Cancelled",
    refunded: "Cancelled",
  };

  return map[normalized] ?? "Pending";
};

export const cancelOrder = async (
  id: string,
  userId?: string
): Promise<Order> => {
  let response;

  try {
    response = await api.delete<{ success: boolean; data?: BackendOrder }>(
      `/v1/orders/${id}`
    );
  } catch (error) {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      const status = error.response?.status;

      if (status === 403) {
        throw new Error("This order is not available for this account");
      }

      if (status === 409) {
        throw new Error(
          error.response?.data?.message ?? "Order could not be cancelled"
        );
      }

      throw new Error(error.response?.data?.message ?? "Could not cancel order");
    }

    throw error;
  }

  return response.data.data
    ? toOrder(response.data.data, userId)
    : ({
        id,
        createdAt: new Date().toISOString(),
        status: "Cancelled",
        items: [],
        total: 0,
        userId,
      } satisfies Order);
};

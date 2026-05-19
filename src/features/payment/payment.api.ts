import api from "@/lib/axios";

const paymentAttemptPrefix = "smarttrens:payment-attempt:";

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getPaymentAttemptKey = (orderId: string) => {
  if (typeof window === "undefined") return `payment:${orderId}:${randomId()}`;

  const storageKey = `${paymentAttemptPrefix}${orderId}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const next = `payment:${orderId}:${randomId()}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
};

interface RazorpayOrderResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    amount: number;
    currency: "INR";
    receipt: string;
  };
}

export interface RazorpayVerificationPayload {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
  };
}

export const createRazorpayOrder = async (
  orderId: string
): Promise<RazorpayOrderResponse["data"]> => {
  const response = await api.post<RazorpayOrderResponse>("/v1/payments/create", {
    orderId,
  }, {
    headers: {
      "Idempotency-Key": getPaymentAttemptKey(orderId),
    },
  });

  return response.data.data;
};

export const verifyRazorpayPayment = async (
  payload: RazorpayVerificationPayload
): Promise<PaymentVerificationResponse> => {
  const response = await api.post<PaymentVerificationResponse>(
    "/v1/payments/verify",
    payload
  );

  return response.data;
};

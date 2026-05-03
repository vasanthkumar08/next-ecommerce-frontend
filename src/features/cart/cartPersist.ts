import { CartItem } from "./cartSlice";

const getCartKey = (userId?: string | null) =>
  userId ? `cart:${userId}` : "cart:guest";

export const saveCart = (state: CartItem[], userId?: string | null) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(userId), JSON.stringify(state));
};

export const loadCart = (userId?: string | null): CartItem[] | undefined => {
  if (typeof window === "undefined") return undefined;
  const data = localStorage.getItem(getCartKey(userId));

  if (data) return JSON.parse(data) as CartItem[];

  const legacyCart = localStorage.getItem("cart");
  return legacyCart ? (JSON.parse(legacyCart) as CartItem[]) : undefined;
};

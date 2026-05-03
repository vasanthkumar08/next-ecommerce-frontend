import { CartItem } from "./cartSlice";

const getCartKey = (userId?: string | null) =>
  userId ? `cart:${userId}` : "cart:guest";

const parseCart = (data: string | null): CartItem[] =>
  data ? (JSON.parse(data) as CartItem[]) : [];

const mergeCartItems = (primary: CartItem[], secondary: CartItem[]) => {
  const byId = new Map<string, CartItem>();

  [...primary, ...secondary].forEach((item) => {
    const existing = byId.get(item.id);

    if (existing) {
      existing.quantity += item.quantity;
      return;
    }

    byId.set(item.id, { ...item });
  });

  return Array.from(byId.values());
};

export const saveCart = (state: CartItem[], userId?: string | null) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(userId), JSON.stringify(state));
};

export const loadCart = (userId?: string | null): CartItem[] | undefined => {
  if (typeof window === "undefined") return undefined;

  const userCart = parseCart(localStorage.getItem(getCartKey(userId)));
  const guestCart = userId ? parseCart(localStorage.getItem(getCartKey(null))) : [];

  if (userId && guestCart.length > 0) {
    const merged = mergeCartItems(userCart, guestCart);
    localStorage.setItem(getCartKey(userId), JSON.stringify(merged));
    localStorage.removeItem(getCartKey(null));
    return merged;
  }

  if (userCart.length > 0) return userCart;

  const legacyCart = localStorage.getItem("cart");
  return legacyCart ? (JSON.parse(legacyCart) as CartItem[]) : undefined;
};

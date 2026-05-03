import { CartItem } from "./cartSlice";

const objectIdPattern = /^[a-f\d]{24}$/i;

const getCartKey = (userId?: string | null) =>
  userId ? `cart:${userId}` : "cart:guest";

const parseCart = (data: string | null): CartItem[] =>
  data ? (JSON.parse(data) as CartItem[]) : [];

const sanitizeCart = (items: CartItem[]) =>
  items.filter(
    (item) =>
      objectIdPattern.test(item.id) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
  );

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
  localStorage.setItem(getCartKey(userId), JSON.stringify(sanitizeCart(state)));
};

export const loadCart = (userId?: string | null): CartItem[] | undefined => {
  if (typeof window === "undefined") return undefined;

  const userCart = sanitizeCart(parseCart(localStorage.getItem(getCartKey(userId))));
  const guestCart = userId
    ? sanitizeCart(parseCart(localStorage.getItem(getCartKey(null))))
    : [];

  if (userId && guestCart.length > 0) {
    const merged = mergeCartItems(userCart, guestCart);
    localStorage.setItem(getCartKey(userId), JSON.stringify(merged));
    localStorage.removeItem(getCartKey(null));
    return merged;
  }

  if (userCart.length > 0) return userCart;

  const legacyCart = localStorage.getItem("cart");
  return legacyCart ? sanitizeCart(JSON.parse(legacyCart) as CartItem[]) : undefined;
};

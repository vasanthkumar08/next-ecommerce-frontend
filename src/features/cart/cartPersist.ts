import { CartItem } from "./cartSlice";

const objectIdPattern = /^[a-f\d]{24}$/i;

const getCartKey = (userId?: string | null) =>
  userId ? `cart:${userId}` : null;

const parseCart = (data: string | null): CartItem[] =>
  data ? (JSON.parse(data) as CartItem[]) : [];

const sanitizeCart = (items: CartItem[]) =>
  items.filter(
    (item) =>
      objectIdPattern.test(item.id) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
  );

export const mergeCartItems = (primary: CartItem[], secondary: CartItem[]) => {
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
  const key = getCartKey(userId);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(sanitizeCart(state)));
};

export const loadCart = (userId?: string | null): CartItem[] | undefined => {
  if (typeof window === "undefined") return undefined;
  const key = getCartKey(userId);
  if (!key) return [];

  const userCart = sanitizeCart(parseCart(localStorage.getItem(key)));

  // This cache is display-only and is never allowed to create authenticated
  // ecommerce state. Backend hydration remains the only cart authority.
  if (userCart.length > 0) return userCart;

  return [];
};

"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, decreaseQuantity, removeFromCart } from "@/features/cart/cartSlice";
import Image from "next/image";
import Link from "next/link";

export default function CartPage() {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((state) => state.cart.items);

  const total = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="mx-auto grid min-w-0 max-w-7xl gap-6 px-3 py-6 sm:px-4 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      {/* LEFT — product list */}
      <div>
        <h1 className="mb-6 text-2xl font-bold text-[#111111]">
          Shopping Cart
        </h1>

        {cartItems.length === 0 ? (
          <div className="rounded-xl border border-[#e0e0e0] bg-white p-6 text-center shadow-sm sm:p-12">
            <p className="mb-1 text-4xl">🛒</p>
            <p className="mb-4 text-[#666666]">Your cart is empty</p>
            <Link
              href="/shop/products"
              className="inline-block rounded-lg bg-[#ff9900] px-6 py-2 font-semibold text-white transition hover:bg-[#e88a00]"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-[#e0e0e0] bg-white p-3 shadow-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                  <Image
                    src={item.image || "/placeholder.png"}
                    alt={item.title}
                    fill
                    className="object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="line-clamp-2 font-semibold text-[#111111]">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-lg font-bold text-[#ff6700]">
                    ${item.price.toFixed(2)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => dispatch(decreaseQuantity(item.id))}
                      className="h-7 w-7 rounded border border-[#e0e0e0] bg-[#f5f5f5] text-sm font-bold transition hover:bg-[#e0e0e0]"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => dispatch(addToCart(item))}
                      className="h-7 w-7 rounded border border-[#e0e0e0] bg-[#f5f5f5] text-sm font-bold transition hover:bg-[#e0e0e0]"
                    >
                      +
                    </button>
                    <button
                      // ✅ FIX: was String(item.id) — now correctly number
                      onClick={() => dispatch(removeFromCart(item.id))}
                      className="text-sm font-semibold text-red-500 transition hover:text-red-700 sm:ml-3"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <p className="col-span-2 justify-self-end font-bold text-[#111111] sm:col-span-1">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT — order summary */}
      <aside className="h-fit min-w-0 rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-[#111111]">
          Order Summary
        </h2>
        <div className="space-y-2 text-sm text-[#666666]">
          <div className="flex justify-between">
            <span>
              Subtotal ({cartItems.reduce((a, i) => a + i.quantity, 0)} items)
            </span>
            <span className="font-medium text-[#111111]">
              ${total.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="font-medium text-[#ff6700]">FREE</span>
          </div>
        </div>
        <div className="my-4 border-t border-[#e0e0e0]" />
        <div className="flex justify-between text-base font-bold text-[#111111]">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <Link
          href="/shop/checkout"
          className="mt-4 block rounded-lg bg-[#ff9900] py-3 text-center font-semibold text-white transition hover:bg-[#e88a00]"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/shop/products"
          className="mt-2 block text-center text-sm text-[#ff6700] hover:underline"
        >
          Continue Shopping
        </Link>
      </aside>
    </div>
  );
}

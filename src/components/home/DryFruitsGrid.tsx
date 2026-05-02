"use client";

import Image from "next/image";
import { ShoppingCart } from "lucide-react";

interface DryFruitProduct {
  name: string;
  price: string;
  image: string;
}

const dryFruitProducts: DryFruitProduct[] = [
  {
    name: "Premium California Almonds",
    price: "Rs. 499",
    image:
      "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Whole Cashew Nuts",
    price: "Rs. 649",
    image:
      "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Medjool Dates Pack",
    price: "Rs. 399",
    image:
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Pistachio Gift Box",
    price: "Rs. 799",
    image:
      "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=900&q=85",
  },
];

export default function DryFruitsGrid() {
  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6700]">
            Premium Picks
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-800">
            Dry Fruits Collection
          </h2>
        </div>
        <p className="max-w-sm text-sm font-medium text-slate-500">
          Handpicked nuts and dates packed for daily snacking and gifting.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {dryFruitProducts.map((product) => (
          <article
            key={product.name}
            className="group overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </div>

            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-black leading-5 text-slate-800">
                  {product.name}
                </h3>
                <p className="shrink-0 text-sm font-black text-[#ff6700]">
                  {product.price}
                </p>
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#ff6700] px-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-[#f05f00] active:scale-95"
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

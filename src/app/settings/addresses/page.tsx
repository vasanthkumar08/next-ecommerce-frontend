"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus, Star, Trash2 } from "lucide-react";
import api from "@/lib/axios";

type Address = {
  _id: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  houseNumber?: string;
  apartment?: string;
  addressLine: string;
  street?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = {
  name: "",
  phone: "",
  alternatePhone: "",
  houseNumber: "",
  apartment: "",
  street: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

const isValidPhone = (value: string) => /^[6-9]\d{9}$/.test(value);
const isValidPostal = (value: string) => /^[1-9][0-9]{5}$/.test(value);

export default function AddressSettingsPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: Address[] }>("/v1/addresses");
      setAddresses(response.data.data);
    } catch {
      setError("Sign in to manage saved addresses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAddresses();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submitAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !isValidPhone(form.phone)) {
      setError("Full name and a valid 10-digit phone number are required.");
      return;
    }

    if (form.alternatePhone && !isValidPhone(form.alternatePhone)) {
      setError("Alternate phone number must be a valid 10-digit number.");
      return;
    }

    if (!form.houseNumber.trim() || !form.street.trim()) {
      setError("House / flat number and street are required.");
      return;
    }

    if (!isValidPostal(form.pincode)) {
      setError("Postal code must be a valid 6-digit code.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post("/v1/addresses", {
        ...form,
        addressLine: [
          form.houseNumber,
          form.apartment,
          form.street,
          form.landmark,
        ]
          .filter(Boolean)
          .join(", "),
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadAddresses();
    } catch {
      setError("Address could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    await api.put(`/v1/addresses/${id}/default`);
    await loadAddresses();
  };

  const removeAddress = async (id: string) => {
    await api.delete(`/v1/addresses/${id}`);
    await loadAddresses();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <MapPin className="h-7 w-7 text-[#ff6700]" />
              <h1 className="mt-4 text-2xl font-black text-slate-950">
                Saved Addresses
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Manage delivery and billing addresses.
              </p>
            </div>
            <button
              onClick={() => setShowForm((open) => !open)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#ff6700] px-4 py-3 text-sm font-black text-white"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {showForm && (
            <form
              onSubmit={submitAddress}
              className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
            >
              {Object.keys(emptyForm).map((key) => (
                <input
                  key={key}
                  value={form[key as keyof typeof form]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={key.replace(/([A-Z])/g, " $1")}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:capitalize focus:border-[#ff6700]"
                />
              ))}
              <button
                disabled={saving}
                className="rounded-2xl bg-[#ff6700] px-5 py-3 text-sm font-black text-white transition hover:bg-[#f05f00] disabled:opacity-60 md:col-span-2"
              >
                {saving ? "Saving..." : "Save Address"}
              </button>
            </form>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-3xl bg-slate-100"
                />
              ))
            ) : addresses.length ? (
              addresses.map((address) => (
                <div
                  key={address._id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">
                        {address.name}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {address.phone}
                        {address.alternatePhone
                          ? ` / ${address.alternatePhone}`
                          : ""}
                      </p>
                    </div>
                    {address.isDefault && (
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#ff6700]">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {address.addressLine}, {address.city}, {address.state} -{" "}
                    {address.pincode}, {address.country}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => setDefault(address._id)}
                      disabled={address.isDefault}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 transition hover:border-[#ff6700] disabled:opacity-50"
                    >
                      <Star className="h-4 w-4" />
                      Set Default
                    </button>
                    <button
                      onClick={() => removeAddress(address._id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-xs font-black text-red-600 transition hover:border-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500 md:col-span-2">
                No saved addresses yet.
              </div>
            )}
          </div>

          <Link
            href="/settings"
            className="mt-6 inline-flex rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700]"
          >
            Back to Settings
          </Link>
        </section>
      </div>
    </main>
  );
}

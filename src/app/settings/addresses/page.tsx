"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, MapPin, Plus, Star, Trash2, X } from "lucide-react";
import api from "@/lib/axios";
import {
  Address,
  AddressForm,
  addressTypes,
  buildAddressLine,
  countries,
  digitsAndPlusOnly,
  emptyAddressForm,
  formatAddress,
  isValidPhone,
  isValidPostalCode,
  normalizePhone,
} from "@/lib/address";

const toForm = (address: Address): AddressForm => ({
  name: address.name ?? "",
  phone: address.phone ?? "",
  alternatePhone: address.alternatePhone ?? "",
  houseNumber: address.houseNumber ?? "",
  apartment: address.apartment ?? "",
  street: address.street ?? "",
  landmark: address.landmark ?? "",
  city: address.city ?? "",
  state: address.state ?? "",
  pincode: address.pincode ?? "",
  country: address.country ?? "India",
  addressType: address.addressType ?? "Home",
});

export default function AddressSettingsPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressForm>(emptyAddressForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.name === form.country) ?? countries[0],
    [form.country]
  );

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

  const updateField = <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyAddressForm);
    setEditingId(null);
    setShowForm(false);
  };

  const submitAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const addressLine = buildAddressLine(form);

    if (!form.name.trim() || !isValidPhone(form.phone)) {
      setError("Full name and a valid phone number are required.");
      return;
    }

    if (form.alternatePhone && !isValidPhone(form.alternatePhone)) {
      setError("Alternate phone number must include only digits and an optional country code.");
      return;
    }

    if (!form.houseNumber.trim() || !form.street.trim()) {
      setError("House / flat number and street are required.");
      return;
    }

    if (!form.city.trim() || !form.state.trim() || !isValidPostalCode(form.pincode)) {
      setError("City, state, and a valid postal or zip code are required.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      phone: normalizePhone(form.phone),
      alternatePhone: form.alternatePhone ? normalizePhone(form.alternatePhone) : undefined,
      addressLine,
    };

    try {
      if (editingId) {
        await api.put(`/v1/addresses/${editingId}`, payload);
      } else {
        await api.post("/v1/addresses", payload);
      }
      resetForm();
      await loadAddresses();
    } catch {
      setError("Address could not be saved. Please check the details and try again.");
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
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <MapPin className="h-7 w-7 text-[#ff6700]" />
              <h1 className="mt-4 text-2xl font-black text-slate-950">Saved Addresses</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Manage global delivery and billing addresses.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                setForm(emptyAddressForm);
                setShowForm((open) => !open);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ff6700] px-4 text-sm font-black text-white"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {error && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {showForm && (
            <form
              onSubmit={submitAddress}
              className="mt-6 grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2"
            >
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Full name" className="input-base" autoComplete="name" />
              <input value={form.phone} onChange={(event) => updateField("phone", digitsAndPlusOnly(event.target.value))} placeholder={`${selectedCountry.code} phone number`} className="input-base" inputMode="tel" autoComplete="tel" />
              <input value={form.alternatePhone} onChange={(event) => updateField("alternatePhone", digitsAndPlusOnly(event.target.value))} placeholder="Alternate phone number" className="input-base" inputMode="tel" />
              <input value={form.houseNumber} onChange={(event) => updateField("houseNumber", event.target.value)} placeholder="House / flat number" className="input-base" />
              <input value={form.apartment} onChange={(event) => updateField("apartment", event.target.value)} placeholder="Apartment / building" className="input-base" />
              <input value={form.street} onChange={(event) => updateField("street", event.target.value)} placeholder="Street" className="input-base" />
              <input value={form.landmark} onChange={(event) => updateField("landmark", event.target.value)} placeholder="Landmark" className="input-base" />
              <input value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="City" className="input-base" />
              <input value={form.state} onChange={(event) => updateField("state", event.target.value)} placeholder="State / province" className="input-base" />
              <input value={form.pincode} onChange={(event) => updateField("pincode", event.target.value)} placeholder={selectedCountry.postalLabel} className="input-base" autoComplete="postal-code" />
              <div>
                <input list="country-options" value={form.country} onChange={(event) => updateField("country", event.target.value)} placeholder="Search country" className="input-base" />
                <datalist id="country-options">
                  {countries.map((country) => (
                    <option key={country.name} value={country.name}>
                      {country.code}
                    </option>
                  ))}
                </datalist>
              </div>
              <select value={form.addressType} onChange={(event) => updateField("addressType", event.target.value as AddressForm["addressType"])} className="input-base">
                {addressTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
                <button disabled={saving} className="min-h-11 flex-1 rounded-xl bg-[#ff6700] px-5 text-sm font-black text-white transition hover:bg-[#f05f00] disabled:opacity-60">
                  {saving ? "Saving..." : editingId ? "Update Address" : "Save Address"}
                </button>
                <button type="button" onClick={resetForm} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700">
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
              ))
            ) : addresses.length ? (
              addresses.map((address) => (
                <div key={address._id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{address.name}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                        {address.phone}{address.alternatePhone ? ` / ${address.alternatePhone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{address.addressType ?? "Home"}</span>
                      {address.isDefault && <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#ff6700]">Default</span>}
                    </div>
                  </div>
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">{formatAddress(address)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => { setForm(toForm(address)); setEditingId(address._id); setShowForm(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                    <button onClick={() => setDefault(address._id)} disabled={address.isDefault} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-50">
                      <Star className="h-4 w-4" />
                      Set Default
                    </button>
                    <button onClick={() => removeAddress(address._id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-black text-red-600">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500 lg:col-span-2">
                No saved addresses yet.
              </div>
            )}
          </div>

          <Link href="/settings" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:border-[#ff6700] hover:text-[#ff6700]">
            Back to Settings
          </Link>
        </section>
      </div>
    </main>
  );
}

export type AddressType = "Home" | "Work" | "Office" | "Other";

export type Address = {
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
  addressType: AddressType;
  isDefault: boolean;
};

export type AddressForm = {
  name: string;
  phone: string;
  alternatePhone: string;
  houseNumber: string;
  apartment: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: AddressType;
};

export const addressTypes: AddressType[] = ["Home", "Work", "Office", "Other"];

export const countries = [
  { name: "India", code: "+91", postalLabel: "PIN code" },
  { name: "USA", code: "+1", postalLabel: "ZIP code" },
  { name: "UK", code: "+44", postalLabel: "Postcode" },
  { name: "Canada", code: "+1", postalLabel: "Postal code" },
  { name: "Australia", code: "+61", postalLabel: "Postcode" },
  { name: "UAE", code: "+971", postalLabel: "Postal code" },
  { name: "Singapore", code: "+65", postalLabel: "Postal code" },
  { name: "Germany", code: "+49", postalLabel: "Postal code" },
  { name: "France", code: "+33", postalLabel: "Postal code" },
  { name: "Japan", code: "+81", postalLabel: "Postal code" },
] as const;

export const emptyAddressForm: AddressForm = {
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
  addressType: "Home",
};

export const digitsAndPlusOnly = (value: string) =>
  value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");

export const normalizePhone = (value: string) =>
  digitsAndPlusOnly(value).replace(/^00/, "+");

export const isValidPhone = (value: string) =>
  /^\+?\d{7,15}$/.test(normalizePhone(value));

export const isValidPostalCode = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/.test(value.trim());

export const buildAddressLine = (form: AddressForm) =>
  [form.houseNumber, form.apartment, form.street, form.landmark]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

export const formatAddress = (address: Address) =>
  [
    address.addressLine,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

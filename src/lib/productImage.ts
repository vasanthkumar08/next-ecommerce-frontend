export const PRODUCT_IMAGE_FALLBACK = "/placeholder.svg";

const trustedImageHosts = new Set([
  "fakestoreapi.com",
  "i.pravatar.cc",
  "images.unsplash.com",
  "res.cloudinary.com",
]);

export function getSafeProductImage(
  value: string | null | undefined,
  fallback = PRODUCT_IMAGE_FALLBACK
) {
  const image = value?.trim();

  if (!image) return fallback;

  if (image.startsWith("/") && !image.startsWith("//")) {
    return image;
  }

  try {
    const url = new URL(image);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:" || !trustedImageHosts.has(hostname)) {
      return fallback;
    }

    return url.toString();
  } catch {
    return fallback;
  }
}

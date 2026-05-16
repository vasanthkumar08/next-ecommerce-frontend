export function normalizeApiBaseUrl(apiUrl: string) {
  const trimmed = apiUrl.trim().replace(/\/+$/, "");

  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const apiIndex = pathParts.lastIndexOf("api");

    if (apiIndex >= 0) {
      url.pathname = `/${pathParts.slice(0, apiIndex + 1).join("/")}`;
    } else {
      pathParts.push("api");
      url.pathname = `/${pathParts.join("/")}`;
    }

    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "");
  } catch {
    const apiIndex = trimmed.lastIndexOf("/api");

    if (apiIndex >= 0) {
      return trimmed.slice(0, apiIndex + 4);
    }

    return `${trimmed}/api`;
  }
}

export function getApiBaseUrl() {
  const apiUrl =
    typeof window === "undefined"
      ? process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ""
      : process.env.NEXT_PUBLIC_API_URL ?? "";

  return normalizeApiBaseUrl(apiUrl);
}

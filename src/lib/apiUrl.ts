export function normalizeApiBaseUrl(apiUrl: string) {
  const trimmed = apiUrl.trim().replace(/\/+$/, "");

  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts[pathParts.length - 1] !== "api") {
      pathParts.push("api");
      url.pathname = `/${pathParts.join("/")}`;
    }

    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? "");
}

import { auth } from "@/auth";
import { getApiBaseUrl } from "@/lib/apiUrl";
import { NextResponse, type NextRequest } from "next/server";

type OAuthProvider = "google" | "github";

interface BackendAuthResponse {
  success: boolean;
  message?: string;
}

const getInternalAuthSecret = (): string =>
  process.env.AUTH_INTERNAL_SECRET ??
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  process.env.JWT_SECRET ??
  "";

const safeCallbackUrl = (request: NextRequest): URL => {
  const callback = request.nextUrl.searchParams.get("callbackUrl");

  if (!callback) return new URL("/", request.url);

  try {
    const parsed = new URL(callback, request.url);
    return parsed.origin === request.nextUrl.origin
      ? parsed
      : new URL("/", request.url);
  } catch {
    return new URL("/", request.url);
  }
};

const isOAuthProvider = (provider: unknown): provider is OAuthProvider =>
  provider === "google" || provider === "github";

export async function GET(request: NextRequest) {
  const redirectTo = safeCallbackUrl(request);
  const session = await auth();
  const apiUrl = getApiBaseUrl();
  const internalSecret = getInternalAuthSecret();

  if (
    !session?.user?.email ||
    !apiUrl ||
    !internalSecret ||
    !isOAuthProvider(session.provider)
  ) {
    return NextResponse.redirect(redirectTo);
  }

  const backendResponse = await fetch(`${apiUrl}/v1/auth/oauth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Internal-Secret": internalSecret,
    },
    body: JSON.stringify({
      provider: session.provider,
      providerAccountId: session.providerAccountId ?? session.user.email,
      email: session.user.email,
      name: session.user.name ?? undefined,
      avatarUrl: session.user.image ?? undefined,
      emailVerified: true,
      rememberMe: true,
    }),
    cache: "no-store",
  });

  const body = (await backendResponse.json().catch(() => null)) as
    | BackendAuthResponse
    | null;

  if (!backendResponse.ok || body?.success !== true) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth_backend_session");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(redirectTo);
  const setCookie = backendResponse.headers.get("set-cookie");

  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}

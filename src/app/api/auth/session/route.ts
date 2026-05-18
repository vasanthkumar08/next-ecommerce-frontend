import { adminTokenCookie } from "@/lib/admin/jwt";
import { getApiBaseUrl } from "@/lib/apiUrl";
import { NextResponse, type NextRequest } from "next/server";

const accessTokenMaxAge = 15 * 60;

interface BackendMeResponse {
  success: boolean;
  data?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    role?: "admin" | "user" | "manager";
  };
}

const clearSessionCookie = (response: NextResponse, request: NextRequest) => {
  response.cookies.set(adminTokenCookie, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
};

const setSessionCookie = (
  response: NextResponse,
  request: NextRequest,
  accessToken: string
) => {
  response.cookies.set(adminTokenCookie, accessToken, {
    path: "/",
    maxAge: accessTokenMaxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
};

async function verifyBackendSession(accessToken: string) {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) return null;

  const response = await fetch(`${apiUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const body = (await response.json()) as BackendMeResponse;
  const user = body.data;
  const id = user?._id ?? user?.id;

  if (
    !body.success ||
    typeof id !== "string" ||
    typeof user?.name !== "string" ||
    typeof user.email !== "string" ||
    (user.role !== "admin" && user.role !== "manager" && user.role !== "user")
  ) {
    return null;
  }

  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(adminTokenCookie)?.value;

  if (!accessToken) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const user = await verifyBackendSession(accessToken);

  if (!user) {
    const response = NextResponse.json({ success: false }, { status: 401 });
    clearSessionCookie(response, request);
    return response;
  }

  return NextResponse.json({
    success: true,
    accessToken,
    user,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    accessToken?: unknown;
  } | null;
  const accessToken =
    typeof body?.accessToken === "string" ? body.accessToken : "";

  if (!accessToken) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const user = await verifyBackendSession(accessToken);

  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  setSessionCookie(response, request, accessToken);
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response, request);
  return response;
}

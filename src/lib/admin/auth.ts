import { cookies } from "next/headers";
import { adminTokenCookie, verifyAdminToken } from "@/lib/admin/jwt";
import { getApiBaseUrl } from "@/lib/apiUrl";

interface MeResponse {
  success: boolean;
  data?: {
    _id?: string;
    id?: string;
    role?: "admin" | "user" | "manager";
  };
}

async function verifySessionWithBackend(token: string) {
  const apiUrl = getApiBaseUrl();

  if (!apiUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as MeResponse;
    const role = body.data?.role;
    const sub = body.data?._id ?? body.data?.id;

    if (
      !body.success ||
      typeof sub !== "string" ||
      (role !== "admin" && role !== "manager" && role !== "user")
    ) {
      return null;
    }

    return { sub, role };
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const token = (await cookies()).get(adminTokenCookie)?.value;

  if (!token) {
    return null;
  }

  return (await verifyAdminToken(token)) ?? verifySessionWithBackend(token);
}

export { adminTokenCookie, verifyAdminToken };

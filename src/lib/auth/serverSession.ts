import { cookies } from "next/headers";
import { headers } from "next/headers";
import { getApiBaseUrl } from "@/lib/apiUrl";

export type ServerUserSession = {
  id: string;
  email: string;
  role: "admin" | "manager" | "user";
  sessionId?: string;
};

type BackendMeResponse = {
  success: boolean;
  data?: {
    _id?: string;
    id?: string;
    email?: string;
    role?: "admin" | "manager" | "user";
    sessionId?: string;
  };
};

export async function getServerUserSession(): Promise<ServerUserSession | null> {
  const requestHeaders = await headers();
  const accessToken =
    requestHeaders.get("x-vasanth-verified-access-token") ??
    (await cookies()).get("accessToken")?.value;
  const apiUrl = getApiBaseUrl();

  if (!accessToken || !apiUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.info("server_auth_guard", {
        event: "missing_access_cookie_or_api_url",
        hasAccessToken: Boolean(accessToken),
        hasApiUrl: Boolean(apiUrl),
      });
    }

    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.info("server_auth_guard", {
          event: "backend_session_rejected",
          status: response.status,
        });
      }

      return null;
    }

    const body = (await response.json()) as BackendMeResponse;
    const id = body.data?._id ?? body.data?.id;
    const role = body.data?.role;
    const email = body.data?.email;

    if (
      !body.success ||
      typeof id !== "string" ||
      typeof email !== "string" ||
      (role !== "admin" && role !== "manager" && role !== "user")
    ) {
      return null;
    }

    return {
      id,
      email,
      role,
      sessionId: body.data?.sessionId,
    };
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.info("server_auth_guard", {
        event: "backend_session_check_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return null;
  }
}

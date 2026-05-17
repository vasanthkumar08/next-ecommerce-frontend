import { jwtVerify } from "jose";

export const adminTokenCookie = "accessToken";

export interface AdminJwtPayload {
  sub: string;
  role: "admin" | "user" | "manager";
}

function getJwtSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ??
      process.env.AUTH_SECRET ??
      process.env.NEXTAUTH_SECRET ??
      "dev-only-rbac-dashboard-secret-change-me"
  );
}

export async function verifyAdminToken(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    const verified = await jwtVerify(token, getJwtSecret(), {
      issuer: "your-app",
      audience: "your-app-users",
    });
    const role = verified.payload.role;
    const sub = verified.payload.sub;

    if (
      typeof sub !== "string" ||
      (role !== "admin" && role !== "user" && role !== "manager")
    ) {
      return null;
    }

    return { sub, role };
  } catch {
    return null;
  }
}

import type { User } from "@/features/auth/authTypes";

export const getRoleHome = (role: User["role"]) =>
  role === "admin" || role === "manager" ? "/admin/dashboard" : "/shop";

export const canUseLoginNext = (role: User["role"], next: string) => {
  if (!next.startsWith("/") || next.startsWith("//")) {
    return false;
  }

  if (role === "admin" || role === "manager") {
    return next.startsWith("/admin");
  }

  return !next.startsWith("/admin");
};

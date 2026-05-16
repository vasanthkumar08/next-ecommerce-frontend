import type { DefaultSession } from "next-auth";
import type { Role } from "@/types/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
    provider?: "google" | "github";
    providerAccountId?: string;
  }

  interface User {
    role: Role;
  }
}

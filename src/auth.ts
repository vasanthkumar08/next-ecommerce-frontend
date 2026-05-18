import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { z } from "zod";
import type { AuthUser, Role } from "@/types/rbac";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const demoUsers: Array<AuthUser & { password: string }> = [
  {
    id: "usr_admin",
    name: "Admin Owner",
    email: "admin@example.com",
    password: "password123",
    role: "admin",
  },
  {
    id: "usr_manager",
    name: "Store Manager",
    email: "manager@example.com",
    password: "password123",
    role: "manager",
  },
  {
    id: "usr_user",
    name: "Customer User",
    email: "user@example.com",
    password: "password123",
    role: "user",
  },
];

const demoLoginEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXTAUTH_DEMO_LOGIN_ENABLED === "true";

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXTAUTH_DEMO_LOGIN_ENABLED === "true"
) {
  throw new Error("Demo credential login must not be enabled in production");
}

const oauthProviders = [
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: false,
      })
    : null,
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: false,
      })
    : null,
].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "dev-only-rbac-dashboard-secret-change-me"),
  trustHost: true,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...oauthProviders,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        if (!demoLoginEnabled) {
          return null;
        }

        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const user = demoUsers.find(
          (item) =>
            item.email === parsed.data.email &&
            item.password === parsed.data.password
        );

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role as Role | undefined) ?? "user";
        token.provider = account?.provider ?? "credentials";
        token.providerAccountId = account?.providerAccountId ?? user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as Role;
      }

      session.provider =
        token.provider === "google" || token.provider === "github"
          ? token.provider
          : undefined;
      session.providerAccountId =
        typeof token.providerAccountId === "string"
          ? token.providerAccountId
          : undefined;

      return session;
    },
    redirect({ url, baseUrl }) {
      const targetUrl = url.startsWith("/")
        ? `${baseUrl}${url}`
        : url.startsWith(baseUrl)
          ? url
          : baseUrl;

      if (targetUrl.startsWith(`${baseUrl}/api/auth/finalize`)) {
        return targetUrl;
      }

      return `${baseUrl}/api/auth/finalize?callbackUrl=${encodeURIComponent(
        targetUrl
      )}`;
    },
  },
});

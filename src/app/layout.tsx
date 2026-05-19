import { AppProviders } from "@/components/providers/AppProviders";
import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "smarttrens - Shop Smarter",
    template: "%s | smarttrens",
  },
  description: "Premium e-commerce experience",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "smarttrens - Shop Smarter",
    description: "Premium e-commerce experience",
    url: "/",
    siteName: "smarttrens",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "smarttrens - Shop Smarter",
    description: "Premium e-commerce experience",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans text-slate-700 antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

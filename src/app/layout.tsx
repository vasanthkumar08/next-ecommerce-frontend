import { AppProviders } from "@/components/providers/AppProviders";
import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://next-ecommerce-frontend-theta.vercel.app";
const siteName = "C Smart Store";
const siteDescription =
  "Premium Smart Products & Modern Ecommerce Experience";
const previewImage = "/logo.jpg?v=20260526";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "C Smart Store",
    "smart products",
    "premium ecommerce",
    "modern ecommerce",
    "online shopping",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "/",
    siteName,
    images: [
      {
        url: previewImage,
        width: 736,
        height: 736,
        alt: `${siteName} logo`,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: previewImage,
        alt: `${siteName} logo`,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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

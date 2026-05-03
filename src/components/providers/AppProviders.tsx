"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import ReduxProvider from "@/provider/Providers";
import { SiteChrome } from "@/components/layout/SiteChrome";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ReduxProvider>
        <SiteChrome>{children}</SiteChrome>
        <Toaster richColors position="top-right" />
      </ReduxProvider>
    </ThemeProvider>
  );
}

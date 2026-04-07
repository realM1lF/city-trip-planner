"use client";

import { SessionProvider } from "next-auth/react";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { SiteChrome } from "@/components/site-chrome";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppThemeProvider>
        <SiteChrome />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </AppThemeProvider>
    </SessionProvider>
  );
}

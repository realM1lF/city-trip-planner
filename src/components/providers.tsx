"use client";

import { SessionProvider } from "next-auth/react";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { KlaroProvider } from "@/components/consent/klaro-provider";
import { LegalFooter } from "@/components/legal-footer";
import { SiteChrome } from "@/components/site-chrome";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <KlaroProvider>
        <AppThemeProvider>
          <SiteChrome />
          {children}
          <LegalFooter />
          <Toaster position="top-center" richColors closeButton />
        </AppThemeProvider>
      </KlaroProvider>
    </SessionProvider>
  );
}

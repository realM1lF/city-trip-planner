"use client";

import { AppThemeProvider } from "@/components/app-theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </AppThemeProvider>
  );
}

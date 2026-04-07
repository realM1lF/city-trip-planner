import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers";
import "./globals.css";

const THEME_BOOTSTRAP = `(()=>{try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else if(t==='dark')document.documentElement.classList.add('dark');else if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`;

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Städte-Trip-Planner",
  description:
    "Tagesplan mit Karte, Routen und Stopps – auf Basis von Google Maps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning className={inter.variable}>
      <body
        className={`${inter.className} ${geistMono.variable} antialiased`}
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

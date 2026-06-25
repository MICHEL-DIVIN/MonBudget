import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OfflineProvider from "@/lib/offline/provider";
import AuthProvider from "@/lib/auth/provider";
import CurrencyProvider from "@/lib/currency/provider";
import ThemeProvider from "@/lib/theme/provider";
import ServiceWorkerRegistrar from "@/app/_components/ServiceWorkerRegistrar";
import ToastProvider from "@/app/_components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mon Budget Familial",
  description:
    "Gérez votre budget familial facilement. Suivez vos revenus, dépenses et objectifs d'épargne.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mon Budget Familial",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="min-h-full font-sans antialiased">
        <AuthProvider>
          <OfflineProvider>
            <CurrencyProvider>
              <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
            </CurrencyProvider>
          </OfflineProvider>
        </AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

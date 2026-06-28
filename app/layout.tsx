import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./icons.css";
import "./globals.css";
import OfflineProvider from "@/lib/offline/provider";
import AuthProvider from "@/lib/auth/provider";
import CurrencyProvider from "@/lib/currency/provider";
import ThemeProvider from "@/lib/theme/provider";
import ServiceWorkerRegistrar from "@/app/_components/ServiceWorkerRegistrar";
import PWAInstallPrompt from "@/app/_components/PWAInstallPrompt";
import I18nProvider from "@/lib/i18n/provider";
import ToastProvider from "@/app/_components/ui/Toast";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ui",
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
  themeColor: "#0b0b12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${sourceSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('monbudget-theme');var d=t==='dark'||(t!=='light'&&(t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:true));document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-full font-sans antialiased">
        <AuthProvider>
          <I18nProvider>
            <OfflineProvider>
              <CurrencyProvider>
                <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
              </CurrencyProvider>
            </OfflineProvider>
          </I18nProvider>
        </AuthProvider>
        <ServiceWorkerRegistrar />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}

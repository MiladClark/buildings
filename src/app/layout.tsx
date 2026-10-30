import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";

import { PwaInstallHint, PwaRegister } from "@/components/pwa";
import { vazirmatn } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "واحدبان",
  title: "واحدبان | مدیریت ساختمان",
  description: "حساب‌وکتاب روشن ساختمان؛ شارژ، هزینه‌ها و پرداخت ساکنان",
  appleWebApp: {
    title: "واحدبان",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#26745d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
        <PwaInstallHint />
        <PwaRegister />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}

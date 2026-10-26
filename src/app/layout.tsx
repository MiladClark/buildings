import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { vazirmatn } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "واحدبان | مدیریت ساختمان",
  description: "حساب‌وکتاب روشن ساختمان؛ شارژ، هزینه‌ها و پرداخت ساکنان",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}

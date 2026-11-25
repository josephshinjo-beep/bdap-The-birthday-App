import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { fontVariables } from "@/styles/fonts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "bdap — the birthday app", template: "%s · bdap" },
  description: "Secret birthday reminders and UPI chip-ins for your class. The birthday person never finds out.",
  applicationName: "bdap",
  appleWebApp: { capable: true, title: "bdap", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
  openGraph: {
    title: "bdap — the birthday app",
    description: "Secret birthday reminders and UPI chip-ins for your class.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff4f7b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-sm">
          Skip to content
        </a>
        <Providers>
          <Suspense fallback={<div className="h-[61px] border-b border-line" />}>
            <Header />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { APP } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: APP.name, template: `%s · ${APP.name}` },
  description: APP.description,
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: APP.themeColor,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden font-sans">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-xs text-mist sm:px-6 lg:px-8">
          {APP.team} · SANA-Sprint on a single T4 GPU · cloud-assisted, not on-device
        </footer>
      </body>
    </html>
  );
}

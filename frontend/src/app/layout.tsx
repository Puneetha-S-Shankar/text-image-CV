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
      <body className="relative flex min-h-full flex-col overflow-x-hidden font-sans">
        {/* Background glow, purely decorative. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 animate-float rounded-full bg-accent-1/25 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-80 w-80 animate-float rounded-full bg-accent-2/15 blur-3xl [animation-delay:-3s]" />
          <div className="absolute bottom-0 -left-24 h-72 w-72 animate-float rounded-full bg-accent-3/10 blur-3xl [animation-delay:-5s]" />
        </div>

        <SiteHeader />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10">{children}</main>
        <footer className="mx-auto w-full max-w-xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-xs text-mist/70">
          {APP.team} · SANA-Sprint on a single T4 GPU · cloud-assisted, not on-device
        </footer>
      </body>
    </html>
  );
}

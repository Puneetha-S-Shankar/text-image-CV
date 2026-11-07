"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP } from "@/lib/config";
import { SparkIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Create" },
  { href: "/compare/", label: "Compare" },
  { href: "/how-it-works/", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));

  return (
    <header className="sticky top-0 z-20 w-full pt-[env(safe-area-inset-top)]">
      <div className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-xl items-center justify-between rounded-2xl border border-white/8 bg-ink-900/80 px-3 py-2 backdrop-blur-xl">
        <Link
          href="/"
          aria-label={APP.name}
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand shadow-lg shadow-fuchsia-500/20">
            <SparkIcon className="h-4 w-4 text-white" />
          </span>
          {/* Name hidden on narrow phones so the three tabs fit on one line. */}
          <span className="hidden whitespace-nowrap min-[420px]:inline">{APP.name}</span>
        </Link>
        <nav aria-label="Main" className="flex gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-lg px-2 py-1.5 whitespace-nowrap transition-colors sm:px-2.5 ${
                isActive(l.href) ? "bg-white/10 text-white" : "text-mist hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

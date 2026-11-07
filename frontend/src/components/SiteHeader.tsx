"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP } from "@/lib/config";
import { SparkIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Create" },
  { href: "/compare/", label: "Compare" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));

  return (
    <header className="sticky top-0 z-20 w-full px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
      <div className="mx-auto mt-3 flex w-full max-w-6xl items-center justify-between rounded-[22px] border border-ink-700 bg-ink-900/95 px-3 py-2 shadow-card-soft sm:px-4">
        <Link
          href="/"
          aria-label={APP.name}
          className="flex min-w-0 shrink-0 items-center gap-2 font-semibold tracking-tight text-espresso"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-action">
            <SparkIcon className="h-4 w-4 text-ink-900" />
          </span>
          <span className="truncate whitespace-nowrap">{APP.name}</span>
        </Link>
        <nav aria-label="Main" className="flex gap-0.5 text-[12px] sm:gap-1 sm:text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-xl px-2 py-2 whitespace-nowrap transition-colors sm:px-3 ${
                isActive(l.href)
                  ? "bg-ink-800 font-medium text-espresso"
                  : "text-mist hover:bg-ink-950 hover:text-espresso"
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

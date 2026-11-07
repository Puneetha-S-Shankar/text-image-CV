import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-gradient text-5xl font-semibold">404</p>
      <p className="text-sm text-mist">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-espresso hover:bg-ink-800"
      >
        Back to Create
      </Link>
    </div>
  );
}

# Frontend rules

These keep the app deployable on our T4 Space and honest in front of the judges. Most are enforced
automatically (`npm run build`, `npm run lint`); the rest are on us. **`npm run verify` must pass before any hand-back.**

## 1. It's a static site: no Next.js server features

`npm run build` turns the app into plain files in `out/`. In production **there is no Node.js server**: our
Python backend just hands those files to the phone. So these Next.js features are **not available**
(the build or `next dev` fails if you use them):

| ❌ Not available                                                     | ✅ Do this instead                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Route handlers that read the request (`app/**/route.ts`), API routes | Call our backend through `src/lib/api.ts`                       |
| Server Actions (`"use server"`)                                      | Same: call the backend from a client component                  |
| `cookies()`, `headers()`, `draftMode()`                              | Nothing needs them; use `localStorage` in the browser if needed |
| Rewrites, redirects, headers in `next.config.ts`                     | Not needed: the backend serves `/api/*` on the same address     |
| `proxy.ts` / middleware                                              | Not available                                                   |
| ISR / `revalidate`                                                   | Data that changes comes from the API at runtime                 |
| `next/image` default optimizer                                       | Plain `<img>` (already set: `images.unoptimized`)               |
| Dynamic routes without `generateStaticParams()`                      | Don't add dynamic routes; we don't need them                    |

Server Components are fine: they run once **at build time**. Anything interactive is a client component (`"use client"`).

## 2. Don't change the hosting settings in `next.config.ts`

`output: "export"`, `trailingSlash: true` and `images.unoptimized` are what make `out/` work on the backend's
static file server. No `basePath`/`assetPrefix`: the site lives at the root of the Space's address.

## 3. All backend calls go through `src/lib/api.ts`

- Components call `generate()` / `getHealth()`. **No `fetch()` anywhere else** (ESLint blocks it).
- **No hard-coded URLs** (`localhost`, `hf.space`, …). `apiBase()` already picks the right address for dev and
  production. To try the real backend while developing, create `.env.development.local` with
  `NEXT_PUBLIC_API_BASE=https://<user>-<space>.hf.space` (that file stays private).
- `src/lib/types.ts` mirrors [API_CONTRACT.md](API_CONTRACT.md). **Never change the contract on one side only.**
  If the UI needs a new field, ask the backend person first, then update the doc, the types and the mock together.

## 4. No secrets, no accounts, no tracking

- There are no API keys in this project and there must never be. Anything starting with `NEXT_PUBLIC_` is
  visible to everyone who opens the site.
- No login, no database, no analytics or third-party trackers, no external fonts/CDNs at runtime (fonts are
  self-hosted by `next/font` at build time).

## 5. Browser-only code runs only in the browser

Pages are pre-rendered at build time where `window`, `navigator`, `localStorage` don't exist. Use them only in
event handlers, `useEffect`, or via `useSyncExternalStore` (see `src/hooks/useBrowserSupport.ts`). Reading them
during render causes build errors or hydration mismatches.

## 6. Mobile first (this is a _mobile_ project)

- Design at **375 px wide** first; then check 390–430 px and a desktop window.
- Test on a **real phone**: Android Chrome and iPhone Safari if possible (see README for the Wi-Fi address).
- Tap targets ≥ 44×44 px. Nothing that only works on hover.
- Text inputs use ≥ 16 px font (otherwise iPhones zoom in on tap).
- Respect the notch / home bar: keep the `env(safe-area-inset-*)` paddings already in the layout.
- The keyboard opening must not hide the prompt box or the Generate button.

## 7. Keep it fast

The whole point of P3 is efficiency; the page shouldn't be the slow part.

- Check the build output: avoid big libraries. Anything heavy (3D, charts) must be lazy-loaded with
  `next/dynamic` and only on the page that needs it.
- Images in `public/` as **WebP**, sized for phones (≤ 1024 px, ideally < 150 KB each).
- Animations: CSS/transform/opacity-based; keep 60 fps on a mid-range phone. Reduced-motion is already respected
  in `globals.css`. Keep it that way.

## 8. Styling conventions

- **Tailwind CSS v4**. Design tokens (colours, animations) live in `src/app/globals.css` under `@theme`. Add new
  colours there, not as random hex codes in components.
- Shared utilities already defined: `glass`, `bg-brand`, `text-gradient`, `shimmer`.
- Prettier sorts Tailwind classes automatically; run `npm run format` (or format-on-save in VS Code).
- Fine to add: **shadcn/ui** (copies components into `src/components/ui`), **motion** (animations),
  **lucide-react** (icons). They're all client-side and work with static export.

## 9. Accessibility

Labels on every input and icon-only button (`aria-label`), `alt` text on pictures, visible focus rings (already
global), enough colour contrast, logical heading order, and the mode switch stays a proper radio group.

## 10. Honesty in the UI (judges will check)

- Say **"cloud-assisted"**. Never claim the model runs on the phone.
- Say **"GenEval-style"** for our checker, never "GenEval".
- Every number on the site comes from **`src/data/results.ts`** (measured in our notebooks) or from the live API
  response. Never type in a number from memory, never round in our favour.
- Mock responses are labelled as mock (the API sends `"mock": true`). Don't hide that in screenshots for the report.

## 11. Leave these alone

- `scripts/fix-static-export.mjs` (fixes a Next.js bug when building on Windows; runs after every build)
- The `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` (Next.js re-adds it)
- `mock/server.mjs` must keep matching the contract: don't make the mock do things the real backend won't

## Before handing back: checklist

- [ ] `npm run verify` passes
- [ ] `npm run preview` → every page works on http://localhost:8080 at phone width
- [ ] Tried: normal prompt, `#fail`, `#busy`, `#error`, empty prompt, mock stopped (offline)
- [ ] Checked on a real phone
- [ ] No `console.log` left behind, no hard-coded URLs, no secrets

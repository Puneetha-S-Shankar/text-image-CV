<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (P3 Studio)

You are working on the frontend of a hackathon project: a mobile web app for fast text-to-image on a T4 GPU.

- Read `docs/FRONTEND_RULES.md` and `docs/API_CONTRACT.md` before changing code.
- This app is a **static export** (`output: "export"`): no route handlers that read requests, server actions,
  cookies/headers, rewrites/redirects, proxy/middleware, ISR, or the default `next/image` optimizer.
- All backend calls go through `src/lib/api.ts`. Never call `fetch()` elsewhere; never hard-code URLs.
- `src/lib/types.ts` mirrors the API contract. Do not change it unless the user says the backend changed too.
- Numbers shown on the site come only from `src/data/results.ts` or the API response. Never invent figures.
- Mobile first (375 px), Tailwind v4 tokens in `src/app/globals.css`, accessible markup.
- Run `npm run verify` (typecheck, lint, format check, build) and make sure it passes before finishing.

# P3 Studio: frontend

The phone-friendly web app for our P3 project (resource-efficient text-to-image). You type a prompt, and our
optimized SANA-Sprint model draws it on a T4 GPU in about a second. The app shows the picture, how long it took,
and whether it passed our quality check. If a try fails the check, the backend automatically tries again at a
higher level; the app shows that too.

**You don't need a GPU or the real backend to work on this.** A mock server (`mock/server.mjs`) imitates the
backend exactly, with placeholder pictures.

> Before you change anything, read **[docs/FRONTEND_RULES.md](docs/FRONTEND_RULES.md)**. The rules keep the app
> deployable. The API you build against is in **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)**.

---

## Quick start

1. Install **Node.js 20.9 or newer** (24 recommended: see `.nvmrc`).
2. In this folder:
   ```bash
   npm install
   npm run dev
   ```
3. Open **http://localhost:3000**. `npm run dev` starts two things together: the mock API (port 8787) and the
   Next.js dev server (port 3000).

**On your phone:** connect it to the same Wi-Fi, then open `http://<your-laptop-ip>:3000` (the terminal prints a
"Network" address). On Windows, if a firewall pop-up asks about Node.js, allow it on **private** networks.

**VS Code:** accept the recommended extensions (ESLint, Prettier, Tailwind CSS IntelliSense, EditorConfig).
Formatting and lint fixes then run on save.

## Commands

| Command             | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`       | Mock API + dev server with hot reload. Use this 95% of the time.                 |
| `npm run dev:web`   | Dev server only (e.g. pointed at the real backend via `.env.development.local`). |
| `npm run mock`      | Mock API only.                                                                   |
| `npm run build`     | Builds the real site into `out/` (static files). Must succeed.                   |
| `npm run preview`   | Builds, then serves `out/` + the mock API on **http://localhost:8080**, exactly  |
|                     | the way the real T4 Space will. Use it before handing work back.                 |
| `npm run verify`    | Typecheck + lint + format check + build. **Must pass before you hand back.**     |
| `npm run format`    | Auto-format everything (also sorts Tailwind classes).                            |
| `npm run lint`      | ESLint.                                                                          |
| `npm run typecheck` | TypeScript.                                                                      |

## Testing different situations with the mock

Type these into the prompt box:

| Prompt                        | What happens                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| anything normal               | Random but realistic: sometimes passes first try, sometimes retries |
| anything + `#pass`            | Passes on the first try                                             |
| anything + `#fail`            | Every try fails: "Best effort" result with the full retry timeline  |
| anything + `#busy`            | HTTP 429 "busy" error                                               |
| anything + `#error`           | HTTP 500 server error                                               |
| a prompt containing `nsfw`    | HTTP 422 "not allowed" error                                        |
| empty / over 400 characters   | HTTP 400 errors                                                     |
| (first 3 s after mock starts) | Server "loading": status pill turns amber, generate returns 503     |
| stop the mock (Ctrl+C)        | "Offline" banner                                                    |

`MOCK_SPEED=0` makes the mock answer instantly; `MOCK_WARMUP_S=20` makes the loading state last longer so you
can design it. Set them before `npm run dev`:

- macOS / Linux / Git Bash: `MOCK_WARMUP_S=20 npm run dev`
- Windows PowerShell: `$env:MOCK_WARMUP_S=20; npm run dev`

## Folder structure

```
frontend/
├── README.md                  ← you are here
├── AGENTS.md                  ← rules for AI coding assistants (Cursor, Copilot, Claude...)
├── docs/
│   ├── FRONTEND_RULES.md      ← the rules: read first
│   ├── API_CONTRACT.md        ← exact request/response format agreed with the backend
│   └── HOSTING.md             ← how the build goes live on the T4 Space
├── mock/server.mjs            ← fake backend (no GPU, no dependencies)
├── scripts/
│   └── fix-static-export.mjs  ← runs after every build (fixes a Next.js bug on Windows)
├── public/                    ← files served as-is (icons/, demo/ pictures for the Compare page)
├── src/
│   ├── app/                   ← pages (Next.js App Router)
│   │   ├── layout.tsx         ← shell: fonts, header, background, footer, phone metadata
│   │   ├── globals.css        ← design tokens (colours, animations) + Tailwind
│   │   ├── page.tsx           ← "/" Create (the main screen)
│   │   ├── compare/           ← "/compare" original vs ours
│   │   ├── how-it-works/      ← "/how-it-works" the pipeline + measured results
│   │   ├── not-found.tsx      ← 404 page
│   │   ├── manifest.ts        ← "Add to Home Screen" app manifest
│   │   └── icon.png, apple-icon.png, favicon.ico
│   ├── components/
│   │   ├── SiteHeader.tsx     ← top bar + navigation
│   │   ├── icons.tsx          ← inline SVG icons
│   │   └── studio/            ← everything on the Create screen
│   │       ├── Studio.tsx         state + layout of the screen
│   │       ├── ImageStage.tsx     the big square: examples / live timer / picture / error
│   │       ├── ResultDetails.tsx  time, level, badges, actions (save, share, copy, again)
│   │       ├── CheckList.tsx      quality check results
│   │       ├── AttemptsTimeline.tsx  the cascade's tries (our main idea: make it shine)
│   │       ├── ModeSwitch.tsx     Fast / Balanced / Quality
│   │       ├── PromptBar.tsx      input + generate button
│   │       ├── StatusPill.tsx     server status + "starting" banner
│   │       └── HistoryStrip.tsx   earlier pictures this session
│   ├── hooks/                 ← useHealth (server status polling), useCanShare
│   ├── lib/
│   │   ├── api.ts             ← the ONLY code that talks to the backend
│   │   ├── types.ts           ← the API contract as TypeScript types
│   │   ├── config.ts          ← app name, modes text, example prompts, limits
│   │   └── image.ts           ← save/share helpers for the returned pictures
│   └── data/
│       ├── results.ts         ← real measured numbers (from the notebooks): don't invent numbers
│       └── compare.ts         ← side-by-side pictures for the Compare page (to fill in)
├── .env.development           ← dev settings (no secrets)
├── .env.production            ← build settings (no secrets)
├── next.config.ts             ← static-export setup: don't change without reading the rules
└── package.json, tsconfig.json, eslint.config.mjs, .prettierrc.json, .editorconfig, .nvmrc, .vscode/
```

## What's already done vs what's yours

**Done (working, tested against the mock):**

- all three pages, mobile-first dark theme, brand gradient
- prompt → picture flow with a live timer, Fast/Balanced/Quality, cancel
- results: time on GPU vs total, level used, tries, pass/best-effort, checks, retry timeline
- save / share / copy prompt / again; history strip
- server status (connecting / loading / ready / offline) and every error case
- installable on phones (manifest + icons); real measured results on "How it works"

**Yours to make great (suggested):**

- [ ] The overall look: make it feel like a polished app, not a template. Typography, spacing, motion
- [ ] The **loading moment** (it's ~1–3 s, so make it feel fast and alive)
- [ ] The **retry timeline** (`AttemptsTimeline.tsx`): this is the project's main idea, so it should be the most
      memorable part of the demo
- [ ] Compare page: side-by-side pictures (after notebook 02b gives us real ones, see `src/data/compare.ts`)
- [ ] App name and team ID (`src/lib/config.ts`)
- [ ] Test on a real Android phone (Chrome) and a real iPhone (Safari), portrait, with the keyboard open
- [ ] Accessibility pass: screen reader labels, contrast, keyboard use
- [ ] Optional extras: an onboarding hint, a "surprise me" prompt button, a richer history view

**Don't build:** login, accounts, databases, payments, anything that needs a server. The app has none, on purpose.

## Handing work back

1. `npm run verify` must pass.
2. `npm run preview` → open http://localhost:8080, check every page on a phone-sized window.
3. Send the folder **without** `node_modules/`, `.next/` and `out/` (zip it or push to the shared Git repo).

# P3 Studio UI Theme Implementation

## Existing design system

The frontend is a static-export Next.js app using Tailwind CSS v4. Its shared tokens and utilities are
defined in `frontend/src/app/globals.css`; the app shell and safe-area handling live in
`frontend/src/app/layout.tsx`. The Create page is composed from stateful studio components, while the
Compare page is backed by measured local data.

The original palette used near-black backgrounds, purple/pink/orange accents, translucent glass cards,
and white text. The main generation workflow and API integration were already implemented. The
technical How It Works page has since been removed from the deployed app.

## Warm palette

The theme is now expressed through shared Tailwind v4 tokens:

| Purpose | Token | Value |
| --- | --- | --- |
| Page background | `ink-950` | `#F5F1EB` |
| Primary surface | `ink-900` | `#FFFCF7` |
| Secondary surface | `ink-800` | `#E8DED2` |
| Borders | `ink-700` | `#DDD2C5` |
| Secondary text | `mist` | `#82776C` |
| Primary text | `espresso` | `#302820` |
| Primary accent | `accent-1` | `#7C5E46` |
| Secondary accent | `accent-2` | `#A77A48` |
| Supporting accent | `accent-3` | `#C29A62` |
| Success | `ok` | `#527B62` |
| Error | `bad` | `#A34F45` |
| Warning | `warn` | `#9A713A` |

Soft surfaces, borders, brand treatments, and focus states use these tokens rather than per-component
hex values. The primary mocha was darkened from the suggested `#8B6F56` to keep small accent labels
readable against ivory. Shadows are restrained and motion continues to respect reduced-motion
preferences.

## Components and pages affected

- `frontend/src/app/globals.css` — shared color tokens, surfaces, focus treatment, and light color scheme.
- `frontend/src/app/layout.tsx` — warm app shell, responsive content width, and page background.
- `frontend/src/lib/config.ts` — theme metadata color and categorized prompt suggestions.
- `frontend/src/components/SiteHeader.tsx` — warm navigation and brand treatment.
- `frontend/src/components/studio/Studio.tsx` — desktop composition, stage flow, and non-submitting inspiration selection.
- `frontend/src/components/studio/ImageStage.tsx` — warm empty/loading/error/picture states.
- `frontend/src/components/studio/PromptBar.tsx` and `ModeSwitch.tsx` — prompt and mode controls.
- `frontend/src/components/studio/ResultDetails.tsx`, `CheckList.tsx`, and `AttemptsTimeline.tsx` — summary, expandable real timing details, checks, and attempt journey.
- `frontend/src/components/studio/HistoryStrip.tsx` — session-only gallery with available result metadata.
- `frontend/src/components/studio/StatusPill.tsx` — server states.
- `frontend/src/components/PromptInspiration.tsx` — lightweight categorized prompt starting points.
- `frontend/src/app/compare/page.tsx` — warm styling and clarification of benchmark versus live-generation checks.
- `frontend/src/app/not-found.tsx` — consistent theme on the 404 page.

## Workflow and features preserved

- Existing prompt limits, mode values, generate/cancel/retry behavior, save/share/copy actions, and
  health polling remain in place.
- All backend communication remains in `frontend/src/lib/api.ts`.
- The existing mock server and API request/response contract are unchanged.
- Image history remains in-memory for the current page visit; it is not persisted.
- Quality and timing displays continue to use values returned by the API.
- Static measured benchmark results on Compare remain sourced from `frontend/src/data/`.
- Existing desktop/mobile layout responsiveness and safe-area support are retained and refined.

## Generation journey and comparison data limits

The returned `attempts[]` entries provide level, resolution, duration, pass/fail, and failure reasons.
The timeline can therefore present each actual generation attempt followed by its actual quality
decision, and identify retries/final output without manufacturing attempts.

The current response contains only the final `image` URL; it does not include an image for every
attempt or an initial-versus-refined image pair. The Compare page shows real static pairs only when
`COMPARE_PAIRS` is populated, otherwise it presents an explicit empty state. A live before/after
cascade comparison would require optional backend response data such as an initial image and a
refined/final image (or per-attempt image references). No such field is required or assumed by this
frontend change.

## Verification

Run `npm run verify` from `frontend/`. The frontend should also be previewed at phone and desktop
widths; browser testing does not replace checking on a real mobile device.

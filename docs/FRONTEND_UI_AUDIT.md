# Frontend UI Audit

## 1. Existing pages and functionality

The frontend is a small Next.js static-export app with three main screens:

- `/` — Create / Studio page
  - prompt entry
  - generation mode selection (Fast / Balanced / Quality)
  - live image preview area
  - quality results and retry details
  - save / share / copy prompt / regenerate actions
  - history strip for recent results in the session
  - mock or real backend health/status handling

- `/compare` — comparison page
  - shows the original vs. optimized outputs
  - likely intended to illustrate before/after improvements
  - uses static demo assets and compare data

The technical `/how-it-works` page was subsequently removed from the deployed app to keep its interface focused on generation and comparison. The app focuses on the core flow: prompt to response, image display, status states, and generation metadata.

## 2. Existing component architecture

The create/studio experience is centered around a single client component, `src/components/studio/Studio.tsx`, which owns the state for:

- prompt text
- selected mode
- generation status (`idle`, `generating`, `done`, `error`)
- previous generation history
- current abort controller

The main subcomponents are:

- `PromptBar.tsx` — prompt textarea + generate button + cancel state
- `ModeSwitch.tsx` — segmented selection for generation mode
- `ImageStage.tsx` — large preview area with empty, loading, image, and error states
- `ResultDetails.tsx` — summary card, actions, quality summary, timeline, and details
- `CheckList.tsx` — semantic and visual quality check breakdown
- `AttemptsTimeline.tsx` — try-by-try generation cascade visualisation
- `StatusPill.tsx` — health status and server readiness banner
- `HistoryStrip.tsx` — session history carousel

Supporting infrastructure:

- `src/lib/api.ts` — the single backend access point
- `src/lib/types.ts` — API contract mirror
- `src/lib/config.ts` — app copy and mode settings
- `src/lib/image.ts` — save/share helpers
- `src/hooks/useHealth.ts` — health polling logic
- `src/data/results.ts` and `src/data/compare.ts` — measured data for report pages

The architecture is clean and fairly well-scoped. The main opportunity is not structural change but stronger visual hierarchy and better interaction polish inside the existing state-driven flow.

## 3. Current visual design and UX problems

The app already has a premium dark aesthetic, but the current implementation still feels a bit generic and slightly “demo-ready but not fully polished.” Key issues:

- The hero/header is functional but not yet strongly branded as a high-end AI studio.
- The create screen primary focus is present, but the hierarchy between prompt, mode selection, preview, and result details is not always visually dominant enough.
- The preview area is the right size, but it lacks stronger sense of focus; it reads more like a utility card than a centerpiece.
- The prompt dock works but feels like a functional mobile chat input rather than a premium generated-content tool.
- The result details are informative, but the layout reads as dense and utilitarian rather than editorial or polished.
- The timeline is conceptually excellent, but it is not visually memorable enough for the project’s main idea.
- Some cards use repeated glass-card styling without enough differentiation between summary, action, and diagnostic panels.

Overall: functional, lightweight, and deployable; but not yet “premium, mobile-first AI creative studio” in tone and spacing.

## 4. Mobile responsiveness problems

The app is mobile-first, and the responsive strategy is sensible, but a few issues remain:

- The top section and prompt dock can feel cramped on narrow screens.
- The prompt area is strong but still somewhat dense; there is limited breathing room around the text area and controls.
- The main layout is not fully optimized for a 375 px device in its tightest form; the right-column result area is more desktop-oriented and can crowd the main screen.
- The image preview is an important focal point, but it can feel boxed in when the layout stacks result panels underneath it.
- The history strip is usable, but it is not yet visually treated as a premium “session memory” area.
- The sticky dock helps usability, yet the current visual treatment can still feel heavy on small screens.

## 5. Accessibility issues

Most of the app is already accessibility-aware, but a few gaps remain:

- The mode switch is designed correctly as a radio group, but more descriptive state messaging would help users understand the tradeoff between modes.
- Some numeric and status text could benefit from stronger contrast or clearer grouping.
- Empty/error/loading states should be more explicit as accessible status announcements, not only visual cues.
- Buttons and controls are mostly usable, but the current emphasis on “one icon + label” patterns could be improved for clarity, especially for smaller screens.
- The prompt textarea is good, but the form could better scaffold a clear visual hierarchy and helper text for validation states.

## 6. Missing UI states

The app includes many states, but there are still a few missing or underdeveloped ones:

- stronger empty-state guidance when the user has not generated anything yet
- more explicit “server warming up” and “warmup/loading” experience beyond a simple banner
- clearer before/after transitions between empty → generating → result → retry flow
- more graceful handling of prompts with unusual quality-check results or partial semantic outputs
- better visual differentiation when a result is a “best effort” rather than a fully passing result

## 7. Existing mock/backend integration

The backend interface is already well-thought-out and intentionally centralized:

- all API calls go through `src/lib/api.ts`
- the app follows the API contract in `src/lib/types.ts`
- the mock backend in `mock/server.mjs` mirrors the production contract closely enough for local development and UI validation

This is a strength of the app. The frontend is intentionally isolated from backend details, which preserves deployment compatibility. The main risk is visual overreach: if the UI starts assuming fields or timings that are not guaranteed, it could drift away from the API contract. The existing architecture avoids that well.

## 8. Components that should be improved

Priority components for this phase:

- `Studio.tsx` — improve hierarchy, desktop balance, and support card messaging
- `ImageStage.tsx` — make the preview the emotional and visual focus of the screen
- `PromptBar.tsx` — better emphasis, validation helpers, and stronger action affordance
- `ModeSwitch.tsx` — communicate tradeoffs more clearly without changing the contract
- `ResultDetails.tsx` — improve summary treatment and result polish
- `AttemptsTimeline.tsx` — make the cascade feel like the main project feature
- `StatusPill.tsx` — make server state feel more premium and intentional
- `HistoryStrip.tsx` — more distinct as a gallery and session memory panel

## 9. Components that should remain unchanged

These are already aligned with the project and should not be heavily rewritten without backend or architectural reason:

- `src/lib/api.ts`
- `src/lib/types.ts`
- `src/lib/config.ts` (copy and mode wording only; not the data contract)
- `mock/server.mjs`
- `src/hooks/useHealth.ts`
- `src/data/results.ts` and `src/data/compare.ts`
- the app shell and layout primitives in `src/app/layout.tsx`
- the general static-export configuration and hosting structure

The goal is to polish the experience without disturbing the backend contract, deployment model, or demo logic.

## 10. Prioritized implementation plan

1. Strengthen the main studio visual hierarchy
   - make the preview more dominant
   - clarify the top-of-page status and project identity
   - improve spacing and emphasis without changing data flow

2. Upgrade the prompt dock
   - larger input and more premium UI treatment
   - clear character counter and validation messaging
   - stronger generate CTA and better busy/disabled states

3. Refine mode communication
   - keep the same mode values and API contract
   - make the tradeoff easy to understand within the segmented control

4. Elevate the result summary and actions
   - better information grouping
   - stronger visual pass/best-effort status
   - cleaner action buttons

5. Improve the cascade timeline
   - more legible retry progression
   - clearer pass/fail reasoning
   - emphasized final outcome and route-start context

6. Polish mobile details
   - reduce cramped stacking on 375 px screens
   - improve sticky footer comfort and spacing
   - ensure touch targets remain comfortable and readable

7. Validate and preserve contract safety
   - keep all backend calls via `src/lib/api.ts`
   - do not change the API contract or mock behavior
   - run the frontend verification commands before completion

## Summary

The existing frontend is already architecturally sound and close to a working product. Its strongest opportunities are not structural—they are visual clarity, premium feel, stronger state communication, and more deliberate emphasis on the core generation workflow. The most important place to improve is the Create page, especially the prompt, preview, and retry timeline, while keeping the backend, deployment setup, and API contracts untouched.

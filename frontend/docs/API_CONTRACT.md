# API contract (frontend ↔ T4 backend)

This is the agreement between the web app and the backend. The TypeScript version is
[`src/lib/types.ts`](../src/lib/types.ts); the mock server [`mock/server.mjs`](../mock/server.mjs) follows it exactly.

**Rule:** if either side needs a change, both sides change together, and this file is updated first.
Adding a new _optional_ response field is fine at any time; renaming or removing a field is a breaking change.

## Basics

- **Same address:** in production the page and the API come from the same server (the T4 Hugging Face Space),
  so the app calls relative paths like `/api/generate`. No CORS involved.
- **Development:** the app calls the mock at `http://<host>:8787` (see `apiBase()` in `src/lib/api.ts`). The mock
  sends permissive CORS headers. The real backend may also enable CORS for local testing.
- **Format:** JSON in, JSON out, UTF-8. All times are **seconds** (floats). Sizes are **pixels**.
- **No authentication, no cookies, no keys.**

---

## `GET /api/health`

Used for the status pill and the "server is starting" banner. Always HTTP 200 while the server process is up.

```json
{
  "ready": true,
  "status": "ready",
  "model": "SANA-Sprint 0.6B · 4-bit · 1024px",
  "gpu": "Tesla T4",
  "uptime_s": 5321,
  "queue": 0
}
```

| Field      | Type                     | Meaning                                                    |
| ---------- | ------------------------ | ---------------------------------------------------------- |
| `ready`    | boolean                  | `false` while the model is still loading after a (re)start |
| `status`   | `"loading"` \| `"ready"` | Same information as text                                   |
| `model`    | string                   | Human-readable setup name                                  |
| `gpu`      | string                   | e.g. `"Tesla T4"`                                          |
| `uptime_s` | number                   | Seconds since the server started                           |
| `queue`    | number                   | Requests currently waiting for the GPU                     |
| `mock`     | boolean (optional)       | `true` only from the mock server                           |

The app polls every 3 s while loading, every 30 s when ready, every 5 s while unreachable.

---

## `POST /api/generate`

### Request

```json
{ "prompt": "two dogs and one cat sitting on a sofa", "mode": "balanced", "seed": 1234 }
```

| Field    | Type                                    | Required | Notes                                   |
| -------- | --------------------------------------- | -------- | --------------------------------------- |
| `prompt` | string                                  | yes      | 1–400 characters after trimming         |
| `mode`   | `"fast"` \| `"balanced"` \| `"quality"` | yes      | See modes below                         |
| `seed`   | integer                                 | no       | Same prompt + seed → same first picture |

**Modes** (the backend decides the details; final time budgets come from notebook 02b):

| Mode       | Starts at         | Retries                                 |
| ---------- | ----------------- | --------------------------------------- |
| `fast`     | cheapest level    | none                                    |
| `balanced` | the router's pick | up to the next level if the check fails |
| `quality`  | full size         | keeps going until it passes or runs out |

### Success: HTTP 200

```json
{
  "id": "a1b2c3d4",
  "image": "data:image/webp;base64,UklGR...",
  "width": 1024,
  "height": 1024,
  "prompt": "two dogs and one cat sitting on a sofa",
  "mode": "balanced",
  "passed": true,
  "level_used": 1,
  "levels_total": 3,
  "attempts": [
    {
      "level": 0,
      "resolution": 768,
      "seed": 1234,
      "time_s": 1.08,
      "passed": false,
      "reasons": ["wrong count: 2 × dog (found 1)"]
    },
    { "level": 1, "resolution": 1024, "seed": 9153, "time_s": 1.71, "passed": true, "reasons": [] }
  ],
  "timing": {
    "total_s": 2.91,
    "generate_s": 2.49,
    "check_s": 0.33,
    "polish_s": 0.03,
    "encode_s": 0.06
  },
  "checks": {
    "clip_score": 27.4,
    "visual": { "ok": true, "flags": [] },
    "semantic": [
      { "kind": "count", "label": "2 × dog", "ok": true },
      { "kind": "object", "label": "cat", "ok": true },
      { "kind": "object", "label": "sofa", "ok": true }
    ]
  },
  "router": { "start_level": 0, "confidence": 0.81 },
  "polish": { "applied": true, "steps": ["gamma"] },
  "model": "SANA-Sprint 0.6B · 4-bit · 1024px",
  "gpu": "Tesla T4"
}
```

| Field                      | Type                 | Meaning                                                                                          |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                       | string               | Unique per picture (use as React key / file name)                                                |
| `image`                    | string (data URL)    | Put straight into `<img src>`. Real backend: `data:image/webp;base64,...` (~30–80 KB). Mock: SVG |
| `width`, `height`          | number               | Final picture size                                                                               |
| `prompt`, `mode`           | string               | Echo of the request (prompt trimmed)                                                             |
| `passed`                   | boolean              | Final picture passed every check. `false` = best effort within the mode's budget                 |
| `level_used`               | number (0-based)     | Cascade level that made the final picture. Show as `level_used + 1` to people                    |
| `levels_total`             | number               | Number of levels (for "Level 2 of 3")                                                            |
| `attempts[]`               | array                | Every try in order; the last one made the returned picture                                       |
| `attempts[].level`         | number (0-based)     |                                                                                                  |
| `attempts[].resolution`    | number               | e.g. 768, 1024                                                                                   |
| `attempts[].seed`          | number               | Each level uses a new seed                                                                       |
| `attempts[].time_s`        | number               | Drawing + checking time of this try                                                              |
| `attempts[].passed`        | boolean              |                                                                                                  |
| `attempts[].reasons`       | string[]             | Plain-language failure reasons; empty when passed                                                |
| `timing.total_s`           | number               | Server time from request received to response ready (**excludes network**)                       |
| `timing.*`                 | number               | Breakdown: drawing, checking, polish, WebP encoding                                              |
| `checks.clip_score`        | number \| null       | CLIP prompt-match score ×100 (≈ 25–30 is typical)                                                |
| `checks.visual`            | `{ok, flags[]}`      | Classical image check: flags like "too dark", "blurry", "low contrast"                           |
| `checks.semantic[]`        | array                | Only things the prompt asked for: `kind` = `object` \| `count` \| `colour` \| `position`         |
| `checks.semantic[].label`  | string               | Display text, e.g. "2 × dog", "red car", "car left of bus"                                       |
| `checks.semantic[].ok`     | boolean              |                                                                                                  |
| `checks.semantic[].detail` | string (optional)    | Extra info when it failed, e.g. "found 1"                                                        |
| `router.start_level`       | number (0-based)     | Where the router chose to start                                                                  |
| `router.confidence`        | number \| null       | 0–1, null when the mode doesn't use the router                                                   |
| `polish`                   | `{applied, steps[]}` | Classical-CV touch-ups that were kept (accept-or-revert)                                         |
| `model`, `gpu`             | string               | For the small print under the result                                                             |
| `mock`                     | boolean (optional)   | `true` only from the mock server                                                                 |

The app also measures the **total time the user waited** in the browser (includes network) and shows both.

### Errors: HTTP 4xx / 5xx

Every error has the same body:

```json
{
  "error": {
    "code": "BUSY",
    "message": "Lots of people are drawing right now. Try again shortly.",
    "retry_after_s": 5
  }
}
```

| HTTP | `code`            | When                                    | `message` shown to user? | App behaviour           |
| ---- | ----------------- | --------------------------------------- | ------------------------ | ----------------------- |
| 400  | `EMPTY_PROMPT`    | prompt empty after trimming             | yes                      | ask to type something   |
| 400  | `PROMPT_TOO_LONG` | over 400 characters                     | yes                      | ask to shorten          |
| 400  | `BAD_MODE`        | unknown mode                            | yes                      | (bug: shouldn't happen) |
| 422  | `UNSAFE_PROMPT`   | blocked by the safety filter            | yes                      | ask for another prompt  |
| 429  | `BUSY`            | GPU queue full                          | yes, + `retry_after_s`   | "Try again" button      |
| 503  | `WARMING_UP`      | model still loading                     | yes, + `retry_after_s`   | "Try again" button      |
| 500  | `INTERNAL`        | anything else (incl. GPU out of memory) | yes                      | "Try again" button      |

The client adds three codes of its own: `NETWORK` (can't connect), `TIMEOUT` (no answer within 60 s) and
`BAD_RESPONSE` (reply wasn't JSON). See `src/lib/api.ts`.

**Messages must be safe to show as-is**: short, friendly, no stack traces.

#!/usr/bin/env node
/**
 * Mock backend: a fake version of the T4 server, for building the UI without a GPU.
 * It follows docs/API_CONTRACT.md exactly, but the pictures are generated placeholder art.
 *
 *   npm run mock                      -> API only on http://localhost:8787 (used by `npm run dev`)
 *   npm run preview                   -> builds the site, then serves out/ + the API on :8080,
 *                                        exactly like the real Space does (one address for both)
 *
 * Test prompts (type these in the app):
 *   anything + "#fail"   every try fails the check (tests the "best effort" UI)
 *   anything + "#pass"   passes on the first try
 *   anything + "#busy"   HTTP 429 BUSY
 *   anything + "#error"  HTTP 500 INTERNAL
 *   "nsfw" / "gore"      HTTP 422 UNSAFE_PROMPT
 *   empty / > 400 chars  HTTP 400
 *   First MOCK_WARMUP_S seconds after start: health says "loading" and generate returns 503.
 *
 * Env: MOCK_WARMUP_S (default 3), MOCK_SPEED (delay multiplier, default 1; 0 = instant).
 * No dependencies: Node.js built-ins only.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ---------- settings ----------
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argValue("port", process.env.PORT || 8787));
const HOST = argValue("host", "0.0.0.0");
const STATIC_DIR = args.includes("--static") ? path.resolve(argValue("static", "out")) : null;
const WARMUP_S = Number(process.env.MOCK_WARMUP_S ?? 3);
const SPEED = Number(process.env.MOCK_SPEED ?? 1);
const PROMPT_MAX_CHARS = 400;
const STARTED = Date.now();

// The cascade levels, cheapest first. Times are rough T4 numbers from notebook 01.
const LEVELS = [
  { resolution: 768, generate_s: 1.05 },
  { resolution: 1024, generate_s: 1.55 },
  { resolution: 1024, generate_s: 1.55 },
];
const CHECK_S = 0.15;
// Same policy as the real backend (src/p3_engine.py DEFAULT_MODES): fast = cheapest level only;
// balanced = start cheap, then retry up the levels; quality = start at full size, then retry.
const MODES = {
  fast: { start: () => 0, maxAttempts: 1 },
  balanced: { start: () => 0, maxAttempts: 3 },
  quality: { start: () => 1, maxAttempts: 3 },
};
const BLOCKED = ["nsfw", "gore", "nude"];

// ---------- small helpers ----------
const sleep = (s) => new Promise((r) => setTimeout(r, Math.max(0, s * SPEED * 1000)));
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const warmingUp = () => (Date.now() - STARTED) / 1000 < WARMUP_S;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function sendError(res, status, code, message, retry_after_s) {
  const error = { code, message };
  if (retry_after_s != null) error.retry_after_s = retry_after_s;
  sendJson(res, status, { error });
}
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > limit) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ---------- a toy prompt reader (the real backend uses p3_semantic.parse_prompt) ----------
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const COLOURS = [
  "red",
  "blue",
  "green",
  "yellow",
  "black",
  "white",
  "orange",
  "purple",
  "pink",
  "brown",
];
const OBJECTS = [
  "dog",
  "cat",
  "car",
  "bus",
  "apple",
  "horse",
  "person",
  "bicycle",
  "chair",
  "cup",
  "bowl",
  "banana",
  "pizza",
  "umbrella",
  "clock",
  "bird",
  "boat",
  "train",
  "laptop",
  "sofa",
  "couch",
  "table",
  "bench",
  "book",
  "vase",
  "teddy bear",
  "giraffe",
  "elephant",
  "zebra",
  "sheep",
  "cow",
];
/** "dogs" -> "dog", "buses" -> "bus", "bus" stays "bus". */
const singular = (w) => {
  if (OBJECTS.includes(w)) return w;
  for (const c of [w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, "")]) {
    if (OBJECTS.includes(c)) return c;
  }
  return w.replace(/s$/, "");
};
const COLOUR_OPT = `(?:(?:${COLOURS.join("|")}) )?`;

function readPrompt(prompt) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const checks = [];
  const seen = new Set();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1] && singular(words[i + 1]);
    if (NUMBERS[w] && next && OBJECTS.includes(next) && NUMBERS[w] > 1) {
      checks.push({ kind: "count", label: `${NUMBERS[w]} × ${next}`, want: NUMBERS[w] });
      seen.add(next);
    } else if (COLOURS.includes(w) && next) {
      checks.push({ kind: "colour", label: `${w} ${next}` });
      seen.add(next);
    }
  }
  const text = words.join(" ");
  // Skip a colour word in front of the second object: "left of a blue bus" -> "bus".
  const rel =
    text.match(
      new RegExp(`(\\w+) (?:to the |on the )?(left|right) of (?:a |an |the )?${COLOUR_OPT}(\\w+)`),
    ) || text.match(new RegExp(`(\\w+) (above|below) (?:a |an |the )?${COLOUR_OPT}(\\w+)`));
  if (rel)
    checks.push({
      kind: "position",
      label: `${singular(rel[1])} ${rel[2]}${/left|right/.test(rel[2]) ? " of" : ""} ${singular(rel[3])}`,
    });
  for (const w of words.map(singular)) {
    if (OBJECTS.includes(w) && !seen.has(w)) {
      checks.push({ kind: "object", label: w });
      seen.add(w);
    }
  }
  return checks.slice(0, 6);
}

function failReason(check) {
  switch (check.kind) {
    case "count":
      return `wrong count: ${check.label} (found ${Math.max(1, check.want - 1)})`;
    case "colour":
      return `wrong colour: ${check.label}`;
    case "position":
      return `wrong position: ${check.label}`;
    default:
      return `missing: ${check.label}`;
  }
}

// ---------- placeholder picture (SVG data URL; the real backend sends WebP) ----------
function escapeXml(s) {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c],
  );
}
function wrap(text, width = 26, maxLines = 5) {
  const lines = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] += " …";
  }
  return lines;
}
function placeholderImage(prompt, seed, level, resolution, passed) {
  const r = rng(seed);
  const h1 = Math.floor(r() * 360),
    h2 = (h1 + 60 + Math.floor(r() * 120)) % 360,
    h3 = (h1 + 200) % 360;
  const blobs = Array.from({ length: 4 }, (_, i) => {
    const cx = Math.floor(r() * 1024),
      cy = Math.floor(r() * 1024),
      rad = 180 + Math.floor(r() * 320);
    const hue = [h1, h2, h3, h2][i];
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="hsl(${hue}, 85%, 60%)" opacity="0.35"/>`;
  }).join("");
  const lines = wrap(prompt)
    .map(
      (l, i) =>
        `<text x="72" y="${600 + i * 62}" font-size="50" font-weight="600" fill="#fff">${escapeXml(l)}</text>`,
    )
    .join("");
  const badge = passed ? "passed check" : "did not pass";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${resolution}" height="${resolution}" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1}, 70%, 35%)"/><stop offset="1" stop-color="hsl(${h2}, 70%, 14%)"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="60"/></filter></defs>
<rect width="1024" height="1024" fill="url(#g)"/><g filter="url(#b)">${blobs}</g>
<g font-family="system-ui, -apple-system, Segoe UI, sans-serif">
<text x="72" y="120" font-size="34" font-weight="700" fill="#fff" opacity="0.9" letter-spacing="6">MOCK PICTURE</text>
<text x="72" y="170" font-size="28" fill="#fff" opacity="0.7">level ${level} · ${resolution}px · seed ${seed} · ${badge}</text>
${lines}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---------- endpoints ----------
function health(res) {
  const ready = !warmingUp();
  sendJson(res, 200, {
    ready,
    status: ready ? "ready" : "loading",
    model: "MOCK · SANA-Sprint 0.6B (placeholder)",
    gpu: "none (mock server)",
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
    queue: 0,
    mock: true,
  });
}

async function generate(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    return sendError(
      res,
      400,
      "EMPTY_PROMPT",
      'Send JSON like {"prompt": "...", "mode": "balanced"}.',
    );
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const mode = body.mode ?? "balanced";

  if (warmingUp()) {
    const left = Math.ceil(WARMUP_S - (Date.now() - STARTED) / 1000);
    return sendError(
      res,
      503,
      "WARMING_UP",
      "The model is still loading. Try again in a few seconds.",
      left,
    );
  }
  if (!prompt) return sendError(res, 400, "EMPTY_PROMPT", "Type something to draw first.");
  if (prompt.length > PROMPT_MAX_CHARS)
    return sendError(
      res,
      400,
      "PROMPT_TOO_LONG",
      `Keep the prompt under ${PROMPT_MAX_CHARS} characters.`,
    );
  if (!MODES[mode])
    return sendError(res, 400, "BAD_MODE", "Mode must be fast, balanced or quality.");
  if (BLOCKED.some((w) => prompt.toLowerCase().includes(w)))
    return sendError(
      res,
      422,
      "UNSAFE_PROMPT",
      "This prompt isn't allowed. Please try something else.",
    );
  if (prompt.includes("#busy"))
    return sendError(
      res,
      429,
      "BUSY",
      "Lots of people are drawing right now. Try again shortly.",
      5,
    );
  if (prompt.includes("#error"))
    return sendError(res, 500, "INTERNAL", "Something went wrong on the server. Please try again.");

  const clean = prompt.replace(/#\w+/g, "").trim() || prompt;
  const checks = readPrompt(clean);
  const baseSeed = Number.isInteger(body.seed) ? body.seed : Math.floor(Math.random() * 2 ** 31);
  const r = rng(baseSeed ^ hash(clean));
  const cfg = MODES[mode];
  const start = cfg.start(checks.some((c) => c.kind !== "object"));
  const passChance = [0.55, 0.75, 0.85];

  const attempts = [];
  let failing = [];
  for (let level = start, n = 0; level < LEVELS.length && n < cfg.maxAttempts; level++, n++) {
    const seed = (baseSeed + level * 7919) % 2 ** 31;
    const passed = prompt.includes("#pass")
      ? true
      : prompt.includes("#fail")
        ? false
        : r() < passChance[level];
    failing = passed ? [] : checks.length ? [checks[Math.floor(r() * checks.length)]] : [];
    const reasons = passed
      ? []
      : failing.length
        ? failing.map(failReason)
        : [["too dark", "blurry", "low contrast"][Math.floor(r() * 3)]];
    const time_s = LEVELS[level].generate_s * (0.92 + r() * 0.16) + CHECK_S;
    attempts.push({
      level,
      resolution: LEVELS[level].resolution,
      seed,
      time_s: round(time_s),
      passed,
      reasons,
    });
    if (passed) break;
  }
  const last = attempts[attempts.length - 1];
  const polish = r() < 0.4 ? ["gamma"] : [];
  const generate_s = attempts.reduce((s, a) => s + a.time_s - CHECK_S, 0);
  const timing = {
    generate_s: round(generate_s),
    check_s: round(CHECK_S * attempts.length),
    polish_s: polish.length ? 0.03 : 0,
    encode_s: 0.04,
  };
  timing.total_s = round(timing.generate_s + timing.check_s + timing.polish_s + timing.encode_s);
  await sleep(timing.total_s);

  sendJson(res, 200, {
    id: randomUUID().slice(0, 8),
    image: placeholderImage(clean, last.seed, last.level, last.resolution, last.passed),
    initial_image: placeholderImage(
      clean,
      attempts[0].seed,
      attempts[0].level,
      attempts[0].resolution,
      attempts[0].passed,
    ),
    width: last.resolution,
    height: last.resolution,
    prompt: clean,
    mode,
    passed: last.passed,
    level_used: last.level,
    levels_total: LEVELS.length,
    attempts,
    timing,
    checks: {
      clip_score: round(25 + r() * 4, 1),
      visual: {
        ok: last.passed || failing.length > 0,
        flags: last.passed || failing.length ? [] : [last.reasons[0]],
      },
      semantic: checks.map((c) => {
        const bad = failing.includes(c);
        return {
          kind: c.kind,
          label: c.label,
          ok: !bad,
          ...(bad ? { detail: failReason(c) } : {}),
        };
      }),
    },
    router: {
      start_level: start,
      confidence: null, // no mode uses the router (notebook 02b: it didn't help)
    },
    polish: { applied: polish.length > 0, steps: polish },
    model: `MOCK · SANA-Sprint 0.6B · ${last.resolution}px`,
    gpu: "none (mock server)",
    mock: true,
  });
}

// ---------- static files (only with --static, to imitate the real Space) ----------
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
function serveStatic(req, res, urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  let file = path.join(STATIC_DIR, safe);
  if (!file.startsWith(STATIC_DIR)) return sendError(res, 400, "INTERNAL", "Bad path.");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!urlPath.endsWith("/")) {
      res.writeHead(308, { Location: urlPath + "/" });
      return res.end();
    }
    file = path.join(file, "index.html");
  }
  let status = 200;
  if (!fs.existsSync(file)) {
    status = 404;
    file = path.join(STATIC_DIR, "404.html");
    if (!fs.existsSync(file)) return sendError(res, 404, "INTERNAL", "Not found.");
  }
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const cache = urlPath.startsWith("/_next/static/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const t0 = Date.now();
  res.on("finish", () => {
    if (url.pathname.startsWith("/api/"))
      console.log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - t0} ms)`);
  });
  try {
    if (url.pathname.startsWith("/api/")) {
      cors(res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      if (url.pathname === "/api/health" && req.method === "GET") return health(res);
      if (url.pathname === "/api/generate" && req.method === "POST")
        return await generate(req, res);
      return sendError(res, 404, "INTERNAL", `No such endpoint: ${req.method} ${url.pathname}`);
    }
    if (STATIC_DIR) return serveStatic(req, res, url.pathname);
    sendJson(res, 200, {
      mock: true,
      message: "Mock API is running. Open the app with `npm run dev`.",
      endpoints: ["GET /api/health", "POST /api/generate"],
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendError(res, 500, "INTERNAL", "Mock server crashed on this request.");
  }
});

if (STATIC_DIR && !fs.existsSync(STATIC_DIR)) {
  console.error(`No ${STATIC_DIR} folder. Run \`npm run build\` first.`);
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  const where = STATIC_DIR ? `site (${path.relative(process.cwd(), STATIC_DIR)}/) + API` : "API";
  console.log(`Mock ${where} on http://localhost:${PORT}  (warm-up ${WARMUP_S}s, speed x${SPEED})`);
});

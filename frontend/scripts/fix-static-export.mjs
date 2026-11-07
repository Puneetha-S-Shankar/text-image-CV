#!/usr/bin/env node
/**
 * Runs automatically after `npm run build` (the "postbuild" script). Safe to run any number of times.
 *
 * Why: Next.js 16.4.5's static export has a Windows-only bug. For nested pages it writes the router's
 * prefetch files with a backslash in the name, so they land in a folder:
 *     out/compare/__next.compare/__PAGE__.txt      (what Windows produces)
 * while the browser asks for
 *     out/compare/__next.compare.__PAGE__.txt      (what Mac/Linux produce)
 * The page still works, but every link prefetch 404s and page switches get slower.
 * This script moves such files to the expected flat name. On Mac/Linux there is nothing to fix.
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2] || "out");
if (!fs.existsSync(OUT)) {
  console.error(`fix-static-export: no ${OUT} folder, nothing to do.`);
  process.exit(0);
}

let moved = 0;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      // Flatten: <dir>/__next.compare/__PAGE__.txt -> <dir>/__next.compare.__PAGE__.txt
      for (const file of filesUnder(full)) {
        const flat = path.relative(dir, file).split(path.sep).join(".");
        fs.renameSync(file, path.join(dir, flat));
        moved++;
      }
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      walk(full);
    }
  }
}

walk(OUT);
console.log(
  moved
    ? `fix-static-export: renamed ${moved} prefetch file(s) (Windows build).`
    : "fix-static-export: nothing to fix.",
);

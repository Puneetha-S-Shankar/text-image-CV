import type { NextConfig } from "next";

/**
 * HOSTING SETUP: read docs/FRONTEND_RULES.md before changing anything in this file.
 *
 * `npm run build` turns the whole site into plain HTML/CSS/JS files in `out/` (a "static export").
 * Our backend, a Hugging Face Space on a T4 GPU, serves that `out/` folder *and* the `/api/*`
 * endpoints from the same address. In production there is no Node.js server, so Next.js server
 * features (API routes, server actions, cookies/headers, rewrites, redirects, proxy, the image
 * optimizer, ISR) are not available. `next dev` and `next build` both raise an error if you use one.
 */
const nextConfig: NextConfig = {
  // Required: emit a static site into `out/`.
  output: "export",

  // Each route becomes a static HTML file under `out/`. Any static file server, including the
  // backend's, can then serve every page without special rewrite rules.
  trailingSlash: true,

  // next/image's optimizer needs a Node server, and we don't have one. Images are served as-is.
  images: { unoptimized: true },

  reactStrictMode: true,

  // Lets you open the dev server from a phone on the same Wi-Fi (http://<laptop-ip>:3000).
  // Only affects `next dev`. If the phone page loads but buttons don't react, add your laptop's
  // exact IP here.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],

  // Tailwind CSS v4 through Turbopack (the default bundler in Next.js 16).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

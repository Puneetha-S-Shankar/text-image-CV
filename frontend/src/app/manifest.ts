import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

// Static export: build this file into out/manifest.webmanifest once, at build time.
export const dynamic = "force-static";

/** Lets phones "Add to Home Screen" and open the app full-screen, like a native app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP.name,
    short_name: APP.name,
    description: APP.description,
    start_url: "/",
    display: "standalone",
    background_color: APP.themeColor,
    theme_color: APP.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

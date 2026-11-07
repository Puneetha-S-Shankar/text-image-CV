import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pictures come from our API as data URLs and the site is a static export with
      // images.unoptimized, so next/image adds nothing. Plain <img> is intended.
      "@next/next/no-img-element": "off",
      // Every backend call goes through src/lib/api.ts (docs/FRONTEND_RULES.md rule 3).
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Call the backend through src/lib/api.ts, not fetch()." },
      ],
    },
  },
  {
    // The two places allowed to call fetch(): the API client and the data-URL helper.
    files: ["src/lib/api.ts", "src/lib/image.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "mock/**"]),
]);

export default eslintConfig;

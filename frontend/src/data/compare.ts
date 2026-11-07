/**
 * Side-by-side examples for the Compare page: the original model vs ours, same prompt.
 *
 * TODO(after 02b): notebook 02b section 14 saves "ours vs original" pictures. Copy a few (WebP)
 * into public/demo/ and list them here, e.g.:
 *   { prompt: "two dogs and one cat", original: "/demo/01_original.webp", ours: "/demo/01_ours.webp",
 *     originalTimeS: 6.1, oursTimeS: 1.3, note: "Ours passed the count check, the original didn't" }
 * Pick honest examples: include at least one where the original wins.
 */
export interface ComparePair {
  prompt: string;
  original: string;
  ours: string;
  originalTimeS: number;
  oursTimeS: number;
  note?: string;
}

export const COMPARE_PAIRS: ComparePair[] = [];

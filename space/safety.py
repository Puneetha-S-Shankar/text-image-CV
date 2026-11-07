"""A basic prompt filter (word list). SANA-Sprint has no built-in safety checker, so this is our only guard.

It's deliberately simple and is listed as a limitation in the write-up: word lists miss paraphrases and can block
innocent prompts. A stronger option for later: an image-side NSFW classifier on every picture before sending it.
"""

from __future__ import annotations

import re

# Sexual content, nudity, graphic violence and self-harm. Matched as whole words, case-insensitive.
BLOCKED_TERMS = [
    "nsfw", "nude", "nudes", "naked", "nudity", "porn", "porno", "pornographic", "sex", "sexual", "sexy", "erotic",
    "explicit", "topless", "lingerie", "genitals", "hentai", "fetish", "xxx",
    "gore", "gory", "beheading", "beheaded", "decapitated", "dismembered", "mutilated", "disembowel",
    "suicide", "self-harm", "self harm",
]
_PATTERN = re.compile(r"\b(" + "|".join(re.escape(t) for t in BLOCKED_TERMS) + r")\b", re.IGNORECASE)


def is_allowed(prompt: str) -> bool:
    return _PATTERN.search(prompt) is None

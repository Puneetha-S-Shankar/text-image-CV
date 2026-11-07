---
title: P3 Studio
emoji: ⚡
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
suggested_hardware: t4-small
pinned: false
short_description: Text-to-image in 1-3 s on a T4 GPU, quality-checked
---

# P3 Studio

Resource-efficient text-to-image for phones. One link serves the mobile web app and the API.

- **Model:** SANA-Sprint 0.6B, 2 steps, low-memory setup (4-bit text reader with its word table on the CPU,
  4-bit drawer, tiled decoding): about 3 GB of GPU memory instead of ~9 GB.
- **Quality-gated cascade:** every picture is checked (visual check + GenEval-style
  object/count/colour/position check + CLIP); if it fails, the next level tries again with a new seed.
  Fast = one 768px try; Balanced = starts at 768px (6 s budget); Quality = starts at 1024px (9 s budget).
- **Cloud-assisted, not on-device:** pictures are made on this T4 GPU, not on the phone.

API: `GET /api/health`, `POST /api/generate` (see `frontend/docs/API_CONTRACT.md` in the project repository),
interactive docs at `/api/docs`.

## Hardware

Set **Settings → Hardware → T4 small**. On free CPU hardware the server only starts with the `P3_MOCK=1`
variable (fake pictures, real checks), which is useful for checking the deployment before paying for a GPU.

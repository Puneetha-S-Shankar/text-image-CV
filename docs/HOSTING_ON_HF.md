# Hosting P3 Studio on Hugging Face (no Colab needed)

Everything the Space needs is already in this repo, so you can deploy **from your laptop**. You don't need a GPU or Colab: Hugging Face builds and runs it on their T4.

**Total time: about 30–45 minutes.**

| Step | Time |
|---|---|
| 1. Account, payment and token | 5–10 min (first time only) |
| 2. Assemble the folder | 1 min |
| 3. Upload | 2–5 min |
| 4. Hugging Face builds the Docker image | 10–20 min |
| 5. First start (downloads the model, ~3–5 GB) | 3–5 min |
| 6. Test on a phone | 5 min |

**Cost:** a T4 small costs about **$0.40 an hour, only while it's running**. Pause it when you're not testing or demoing.

---

## 1. One-time setup

1. Sign up at **huggingface.co** (one team account is enough).
2. **Add a payment method** under Settings → Billing. A GPU Space won't start without one. Do this step yourself in the browser.
3. **Create a token** under Settings → Access Tokens → **New token**. Choose type **Write** and copy it.
   - Never paste the token into a file, notebook or chat. Only paste it into the login prompt in step 3.
4. On your laptop, in PowerShell:
   ```bash
   pip install -U huggingface_hub
   ```

## 2. Assemble the Space folder

From the project folder (`C:\Users\Puneetha\PROJECTS\CV`):
```bash
python space/assemble.py --config results/03a/cascade_config_lowmem.json --requirements results/03b/requirements_tested.txt --out build/space
```
It should print `Assembled … files into build/space (config: cascade_config_lowmem.json)`.

**What goes in:**
- the server (`app.py`, `safety.py`)
- the 3 engine modules from `src/`
- the **low-memory cascade config from 03a**
- the **exact library versions 03b tested**
- the frontend source (Hugging Face builds it on Linux)

`build/` is only a temporary folder. Don't commit it.

## 3. Log in and upload

```bash
hf auth login
```
Paste the token when it asks. If your version doesn't have `hf`, use `huggingface-cli login`.

Then create the Space and upload. Replace `YOUR_USERNAME`, and choose any Space name:
```bash
hf repo create YOUR_USERNAME/p3-studio --repo-type space --space-sdk docker
```
```bash
hf upload YOUR_USERNAME/p3-studio build/space . --repo-type space
```
- If `hf repo create` says the Space already exists, that's fine. Just run the upload.
- Older versions use `huggingface-cli repo create p3-studio --type space --space_sdk docker` and `huggingface-cli upload YOUR_USERNAME/p3-studio build/space . --repo-type space`.

**No-terminal alternative:**
1. On huggingface.co, click **New → Space**, pick SDK **Docker** and choose **Blank**.
2. Open the **Files** tab, click **Add file → Upload files**, and drag in **everything inside** `build/space` (including the `frontend` folder).

## 4. Pick the GPU

1. Open the Space and go to **Settings → Space hardware → T4 small**, then confirm.
2. In the same page, set **Sleep time** to something short, for example **15 minutes**. Then it pauses itself when nobody is using it, and you stop paying.

**Free dry run (optional):**
- Leave the hardware on free CPU and add the variable **`P3_MOCK` = `1`** under Settings → Variables.
- The site loads with fake pictures but real checks. This tests the build and the page for $0.
- Remove the variable before switching to the T4.

## 5. Watch it start

- Open the **Logs** tab. The **Build** log comes first (npm build, then pip install), then the **Container** log (the model loading).
- When it's ready, the status turns **Running**. Open `https://YOUR_USERNAME-p3-studio.hf.space`.
- Quick checks:
  - `https://YOUR_USERNAME-p3-studio.hf.space/api/health` should say the model is ready.
  - `/api/docs` shows the interactive API.

## 6. Test on a phone

- Open the link in Chrome on a phone.
- Try a few unseen prompts in Fast, Balanced and Quality. Each should finish within ~10 s.
  - The measured averages are about 1.5 s, 3.4 s and 3.1 s through the server (03b).
- Try an empty prompt and a blocked word, and check the error messages make sense.

**Testing your local frontend against the real Space:**
1. Set `NEXT_PUBLIC_API_BASE=https://YOUR_USERNAME-p3-studio.hf.space` in `frontend/.env.development`.
2. Run `npm run dev` in `frontend/`.
3. Set it back to empty afterwards to use the free mock again.

---

## Updating after a code change

Run step 2 again, then the `hf upload` line from step 3. The Space rebuilds itself in 10–20 min. Upload a while **before** the demo, not during it.

## On demo day

1. **Start the Space 15–20 min early:** Settings → **Restart** if it's sleeping.
2. Generate a couple of pictures to warm it up.
3. Keep a **backup screen recording** of the app working, in case the venue Wi-Fi or Hugging Face has a problem.
4. **Pause the Space** when you're done: Settings → Pause.

## If something goes wrong

| Problem | Likely fix |
|---|---|
| Build fails at `npm ci` | `frontend/package-lock.json` is missing or out of date. Run `npm install` in `frontend/`, re-assemble and re-upload |
| Build fails at `pip install` | A pinned version isn't available. Re-assemble **without** `--requirements …`, which uses the unpinned `space/requirements.txt` |
| "No GPU" / CUDA error in the Container log | Hardware is still on CPU. Set T4 small (or `P3_MOCK=1` for a dry run) |
| Out of memory | Make sure the config is `cascade_config_lowmem.json` (M3, ~3–4 GB), not the float16 one |
| Stuck on "Starting" for a long time | The first start downloads the model (~3–5 GB). Wait 5 min, then check the Container log |
| Page loads but every request fails | Open `/api/health` and read the Container log for the Python error |
| "Payment required" | Add a payment method under Settings → Billing |

**Note:** `space/README.md` (the Space's description page) still says "a router picks the cheapest level". The app no longer uses the router, so change that line to "starts at the cheapest level" before uploading.

# Deploying FanCompass AI to Vercel

This app is deployed as **two separate Vercel projects**: one for the Next.js
frontend, one for the Express backend (as a serverless function).

## 1. Deploy the backend
1. In Vercel, "Add New Project" → import this repo → set **Root Directory** to `backend`.
2. Framework preset: "Other" (Vercel will detect `backend/api/index.js` as a serverless function automatically).
3. Add environment variables (Project Settings → Environment Variables):
   - `GEMINI_API_KEY` = your Gemini API key
   - `FIREBASE_SERVICE_ACCOUNT` = (optional, leave blank to use the in-memory fallback)
4. Deploy. Note the resulting URL, e.g. `https://fancompass-backend.vercel.app`.

## 2. Deploy the frontend
1. "Add New Project" → import this repo again → set **Root Directory** to `frontend`.
2. Framework preset: Next.js (auto-detected).
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = the backend URL from step 1 (no trailing slash)
4. Deploy.

## Notes
- The two projects talk over plain HTTPS/CORS (CORS is already enabled on the backend).
- If you later want a single-container deploy instead (Docker/Cloud Run), re-add
  `output: 'export'` to `frontend/next.config.mjs` — it was removed for the Vercel
  split since Vercel builds Next.js natively.

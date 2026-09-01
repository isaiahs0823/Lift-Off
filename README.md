# Lift Log

A workout tracking app: templates, multi-day programs (Titan, Reaper, Berserker,
Ragnar, Firefighter, Hybrid, Military/First Responder), a custom plan builder,
a full exercise catalog (including Arsenal Strength machines), progression-based weight
suggestions, and a separate run/conditioning log.

## Local development

```
npm install
npm run dev
```

## Deploy

This is a Vite + React app with a few Vercel serverless functions under `api/` —
deployable to Vercel with minimal config:

1. Push this repo to GitHub.
2. Go to vercel.com, sign in, "Import Project," pick this repo.
3. Framework preset: Vite.
4. In the Vercel project's Settings → Environment Variables, add:

   | Variable            | Required for                              | Notes                                                     |
   |----------------------|--------------------------------------------|-------------------------------------------------------------|
   | `USDA_FDC_API_KEY`   | Nutrition food-name search (`/api/food-search`) | Free key from https://fdc.nal.usda.gov/api-key-signup. Server-side only — never expose this as a `VITE_*` variable, which would ship it in the client bundle. Without it, search returns a clean "food database not configured" error and the rest of Nutrition (barcode scan, quick add, manual entry) keeps working. |
   | `OPENAI_API_KEY`     | AI Coach chat (`/api/coach-chat`)         | Without it, Coach shows its own "Coming Soon" state rather than failing. |
   | `COACH_MODEL`        | AI Coach chat (optional)                  | Defaults to a built-in model id if unset. |

   Barcode scanning (Open Food Facts) and everything else in the app needs no
   environment variables — it's a public, unauthenticated API called directly
   from the browser.
5. Deploy — you'll get a live URL immediately.
6. In the hosting provider's dashboard, add your custom domain and follow the DNS
   instructions it gives you (usually a CNAME record).

## Notes

- Data is stored in the browser's `localStorage`, per-device. There's no account system
  and no cross-device sync yet — if that's needed later, it requires a real backend
  (e.g. Supabase, Postgres + an API) instead of localStorage.
- All styling is Tailwind; icons are `lucide-react`.

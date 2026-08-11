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

This is a standard Vite + React app — deployable to Vercel or Netlify with zero config:

1. Push this repo to GitHub.
2. Go to vercel.com (or netlify.com), sign in, "Import Project," pick this repo.
3. Framework preset: Vite. No environment variables needed.
4. Deploy — you'll get a live URL immediately.
5. In the hosting provider's dashboard, add your custom domain and follow the DNS
   instructions it gives you (usually a CNAME record).

## Notes

- Data is stored in the browser's `localStorage`, per-device. There's no account system
  and no cross-device sync yet — if that's needed later, it requires a real backend
  (e.g. Supabase, Postgres + an API) instead of localStorage.
- All styling is Tailwind; icons are `lucide-react`.

# Isolated iPhone preview

`VITE_LOCAL_ONLY_PREVIEW=true` forces the Supabase client off even when Supabase variables exist in an inherited build environment. It also displays a visible local-test banner and seeds synthetic workout data only when both canonical and active-workout keys are genuinely absent. Existing local data and malformed snapshots are never replaced by demo data. The regular build defaults to the existing cloud configuration; no production project settings are changed.

The supported workout tracker, history, programs, progress, draft recovery and single-editor gate operate locally. Test data uses only `preview-*` identifiers and an explicitly named preview program. Account login/cloud sync is disabled. Public food lookup/server API availability is not part of this static workout preview.

From a clean, committed `feature/workout-data-integrity` checkout, run:

```sh
node scripts/buildLocalPreview.mjs
```

The script creates a new temporary artifact directory, builds static files with the preview flag enabled and both Supabase variables explicitly empty, and emits a deployment-ready `site` path plus a SHA-256 artifact manifest. It neither reads credentials nor links a Vercel project. `/preview-info.json` records the exact source commit and isolation flags. The standard Help & Guide build ID also identifies the commit.

Deploy only this static artifact, not the repository or an existing linked Vercel directory. A temporary preview can be created without logging in using the installed Vercel CLI's `deploy <site> --temporary --yes --environment preview` workflow. Never use `--prod`, an existing production project/domain, or shared preview environment settings for this test. Verify the returned URL and `/preview-info.json` against the committed source before sharing it. A CLI/network failure does not establish that a deployment exists.

Physical iOS Safari/home-screen testing remains necessary. Web Locks and readable storage are required; unsupported environments fail read-only. Separate preview URLs use separate origin storage. Synthetic data remains only in that preview origin, and local-only mode does not access Supabase athlete data.

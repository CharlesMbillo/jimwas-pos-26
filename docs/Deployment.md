# Deployment Runbook

1. Merge to `develop` for sandbox or `main` for production.
2. Confirm the validation workflow is green.
3. Confirm Supabase and Vercel secrets exist in the target protected environment.
4. Review the deployment summary and health-check output.
5. Verify the frontend, Supabase REST gateway, Edge Function gateway, and payment callback URL.

Supabase migrations are applied forward-only with `supabase db push`. Edge Functions are discovered from `supabase/functions/*/index.ts`; `lib` and `tests` are excluded. Payment requests are never sent by health checks.

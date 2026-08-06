# Secrets

Configure these as GitHub Environment secrets, not repository files: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `KCB_BUNI_CALLBACK_URL`. Provider client IDs, passkeys, and secrets belong in Supabase/Vercel environment configuration as appropriate.

Never echo secrets, include them in deployment reports, commit `.env` files, or use `NEXT_PUBLIC_` for private provider credentials. Rotate credentials after suspected exposure and review GitHub secret-scanning alerts.

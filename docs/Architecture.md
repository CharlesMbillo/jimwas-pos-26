# CI/CD Architecture

GitHub Actions is the control plane. Vite builds the frontend, Vercel hosts it, and Supabase hosts database migrations and Edge Functions. `scripts/validate.mjs` is read-only repository validation; `scripts/deploy.mjs` performs the forward deployment; `scripts/health-check.mjs` performs non-mutating endpoint checks; `scripts/rollback.mjs` selects a release ref for controlled redeployment.

Function deployment is directory-driven rather than hardcoded, preventing new POS/payment functions from being silently omitted. Health checks do not call STK Push or any financial provider operation.

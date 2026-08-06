# CI/CD

The repository uses GitHub Actions in this order: `validate.yml`, `deploy-supabase.yml`, `release.yml`, `rollback.yml`, and `security.yml`. Pull requests run validation and security checks only. `develop` deploys to the protected `sandbox` environment; `main` deploys to the protected `production` environment.

Validation runs npm lint/typecheck/build, repository checks, Supabase config lint, and Deno type checks for every discovered Edge Function. Deployments discover function directories dynamically and publish a JSON report. No workflow prints secret values.

Required protected-environment secrets are documented in [Secrets](./Secrets.md). Configure approvals and branch restrictions in GitHub Environments before enabling production deployment.

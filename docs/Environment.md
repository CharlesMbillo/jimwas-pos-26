# Environments

| Git ref | GitHub environment | Supabase target | Vercel target |
| --- | --- | --- | --- |
| `develop` | `sandbox` | sandbox project ref | preview |
| `main` | `production` | production project ref | production |

Pull requests never deploy. Protect both environments with required reviewers, branch restrictions, and environment-scoped secrets. Keep callback URLs environment-specific so sandbox traffic cannot reach production payment records.

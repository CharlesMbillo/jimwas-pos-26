# Rollback Runbook

Use the protected manual `Rollback` workflow and provide an existing release tag. The workflow checks out the tag, redeploys the frontend and all Edge Functions, then runs the health check.

Automated rollback does not delete data or reverse migrations. Database changes are forward-only. If a migration requires compensation, create and review a new forward migration before deploying it. For payment incidents, disable the affected provider through the application settings and preserve callback/audit records.

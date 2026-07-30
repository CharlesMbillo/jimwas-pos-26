# Contributing

Thank you for contributing to Jimwas Enterprises POS. To keep the codebase consistent and maintainable, please follow these guidelines.

## Technology stack
- Backend: Express.js, TypeScript
- ORM: Prisma (Postgres via Neon)
- Frontend: React + TypeScript + Vite
- Offline: Dexie.js (IndexedDB)

## Database changes & migrations
- All schema changes MUST be applied through Prisma.
- Add corresponding Prisma migration files and, where appropriate, raw SQL in the `migrations/` directory for environments that prefer manual SQL application.
- Migration checklist for PRs:
  - Include Prisma schema changes in `prisma/schema.prisma`.
  - Include generated migration SQL (e.g. `migrations/0003-add-...sql`) where required.
  - Explain migration steps in the PR body (how to apply, rollback steps).
  - Add index changes and justify performance impacts.

## Payments and provider credentials
- Provider secrets (client IDs, client secrets, passkeys) MUST remain server-side.
- Client devices enqueue payment intents to IndexedDB (Dexie). Server-side workers perform provider API calls.
- New payment providers must implement the `PaymentProvider` interface (see `src/payments/orchestrator/provider.ts`).

## Tests
- Unit tests should mock Prisma and external network calls.
- Integration tests can run against a staging database; provide setup/teardown steps in PR.
- Add tests for new business logic, especially payment flows and sync behavior.

## PR checklist
- [ ] Code compiles and lints
- [ ] Unit tests added / updated
- [ ] Migration steps clearly described
- [ ] Security review for secrets/credentials
- [ ] Docs updated (ARCHITECTURE.md or README)

## CI
- Unit tests run on every PR. Integration tests run on a schedule or when explicitly enabled.
- Deploys should run `npx prisma migrate deploy` and `npx prisma generate` as part of release pipelines.

# Architecture

This repository follows the Jimwas Enterprises POS approved architecture. See the decision file at: ./Jimwas Enterprises POS — Technology Architecture Decision.txt

Approved stack highlights:
- Backend: Express.js + TypeScript
- ORM: Prisma (Neon PostgreSQL)
- Frontend: React + TypeScript + Vite
- Offline DB: Dexie.js (IndexedDB) with an offline-first synchronization engine
- Object storage: Cloudflare R2 (preferred) / Amazon S3

Keep this architecture as the baseline for all new development. Any deviation requires an architecture-level RFC and approval from the core team.

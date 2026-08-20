<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database / Prisma workflow

- `DATABASE_URL` = local dev DB (Neon `ep-falling-paper-...`). Never run prod operations against it.
- `DATABASE_URL_PROD` = production DB (Neon `ep-broad-hat-...-pooler`).
- The app and Prisma CLI both read `DATABASE_URL` (see `lib/prisma.ts` and `prisma/schema.prisma`). On Vercel, `DATABASE_URL` is set to the prod value; `DATABASE_URL_PROD` is only a local convenience label for targeting prod.
- npm scripts:
  - `npm run db:push` — sync the local dev DB.
  - `npm run db:push:prod` — sync prod for normal column/table changes (runs `prisma db push` with `DATABASE_URL=DATABASE_URL_PROD` via `scripts/db-prod.mjs`).
  - `npm run db:deploy:prod` — apply committed `prisma/migrations` files to prod (`prisma migrate deploy`).
- IMPORTANT: `db push` skips `Unsupported` fields, so it will NOT create the `vector` extension, `note_chunk.embedding vector(1024)`, or the HNSW index. For AI/RAG/pgvector changes (or a fresh prod DB), use `db:deploy:prod`, which applies the manual SQL in `migrations/.../migration.sql`.
- Avoid `prisma migrate dev` — it diffs against a shadow DB and can conflict/reset. The migration history is partially incomplete (versioning was applied via `db push`, not migration files).

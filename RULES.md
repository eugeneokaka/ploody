# Project Rules (for me)

Plain-language cheat sheet for the parts of this project I keep forgetting.

## Databases

I have two databases. They are separate on purpose — so my local experimenting never takes down the live site.

| Name | What it is |
|------|------------|
| `DATABASE_URL` | Local dev database (my playground) |
| `DATABASE_URL_PROD` | Production database (the live site) |

The code and the Prisma CLI only ever read `DATABASE_URL`. On Vercel, `DATABASE_URL` is set to the production value. The `DATABASE_URL_PROD` name exists only in my local `.env` so I can point commands at prod when I need to.

## Updating the database

**Local (while developing):**
```
npm run db:push
```

**Production — normal changes (new columns, tables, etc.):**
```
npm run db:push:prod
```

**Production — AI / vector stuff, or setting up prod from scratch:**
```
npm run db:deploy:prod
```

### The one gotcha that matters

`db push` does **not** create the AI/vector parts of the database (the `vector` extension, the `embedding` column, the search index). So:

- Normal changes → `db:push:prod` is fine.
- Anything to do with AI / embeddings / pgvector → use `db:deploy:prod`.
- Setting up a brand-new prod database → use `db:deploy:prod`.

### Rules of thumb

1. Only run a `prod` command when I actually mean to touch the live site.
2. After changing the database schema locally, always update prod too. Forgetting this makes the live site throw `P2022` ("column does not exist").
3. Do not use `prisma migrate dev`. It compares against a shadow database and can reset/conflict. Use the scripts above instead.

## What happened (the P2022 bug)

The AI/RAG migration (`aiEnabled` column, `note_chunk` table, `vector` extension) was never applied to prod. The deployed code expected `aiEnabled`, so every note request failed. Fix: ran `npm run db:deploy:prod` against prod.

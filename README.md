# Lead → Launch (app)

Next.js 16 dashboard for the Lead → Launch pipeline: **Scrape → Audit → Rank → Build → Outreach**.

> Setup and full usage instructions live in the package root: **`../SETUP-GUIDE.md`**.
> Non-coders: just double-click **`../Launch.command`** (Mac) or **`../Launch.bat`** (Windows).

## Run manually

```bash
npm install      # first time only
npm run dev      # starts on http://localhost:3000
```

Scripts:
- `npm run dev` — dev server (Turbopack)
- `npm run dev:webpack` — dev server on webpack (fallback if Turbopack misbehaves)
- `npm run build` / `npm run start` — production build + serve
- `npm run lint` — eslint

## How the phases run

- **Phase 1 (Scrape)** — Apify (`APIFY_TOKEN`) or the bundled demo dataset (12 Bandra dentists in `data/leads-seed.json`).
- **Phases 2–5 (Audit / Rank / Build / Outreach)** — call the **OpenRouter API** via `lib/claude.ts`. Requires `OPENROUTER_API_KEY` in your `.env.local`.

API routes: `api/audit`, `api/rank`, `api/build-prompt`, `api/outreach` (OpenRouter); `api/scrape` (Apify/demo); `api/claude-status` (badge).

For live scraping, copy `.env.local.example` → `.env.local` and set `APIFY_TOKEN`.

## Notes

- Fonts are system stacks defined in `app/globals.css` (no `next/font/google` — it blocks the build when offline).
- Keep the project at a path **without spaces** for best Turbopack performance; `next.config.ts` contains a fallback for spaced paths.

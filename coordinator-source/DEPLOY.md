# Deployment & setup — Plates for Hope AI Meal Coordinator (canonical source)

This package is the complete application source of the Coordinator as built and verified on Oct 26–27, 2026: React client, Bun server actions (the planning engine), database schema and migrations, dependency manifests, and the submission documents (README.md, SUBMISSION.md, TEST-EVIDENCE.md). A secret scan of this tree found **no API keys, tokens, or passwords** — there are none to configure for the current build.

## Contents
- `client/` — React 19 + TypeScript UI (`src/App.tsx`, `src/api.ts`, `src/theme.css`), build script `client/build.mjs`
- `server/` — Bun server actions (`src/actions.ts` — planning engine, dish library, validation; `src/schema.ts`)
- `drizzle/` — SQLite migrations 0001–0003 (plans table, currency)
- `package.json` / `bun.lock` — pinned dependencies (packageManager: bun@1.3.10)
- `space.json`, `tsconfig.base.json`, `bunfig.toml`, `DATA-PLAN.md` — runtime and data notes

## Run it on the Muse/Hatch runtime (as built)
1. Install Bun 1.3.10.
2. `bun install` (the `@hatch/space-sdk` dependency is a local package of the Muse/Hatch runtime: `file:/opt/hatch/skills/spaces/ts-runtime/dist/space-sdk.tgz` — it provides the actions host and the SQLite store the server actions call).
3. `bun run build` (builds server actions and the client), or `bun run typecheck` to verify types only.
4. The app exposes four actions: `generateplan`, `listplans`, `getplan`, `deleteplan`. Saved plans persist in the runtime's SQLite database (migrations in `drizzle/`).

## Deploy it elsewhere
The planning engine (`server/src/actions.ts`) is self-contained TypeScript with no environment variables and no external calls. To host outside the Muse runtime you replace exactly one boundary — the space-SDK actions host in `server/src/actions.ts` and its client counterpart `client/src/api.ts` — with your host's RPC/HTTP equivalent, and point Drizzle at any SQLite database, applying the migrations in `drizzle/`. Everything else (UI, engine, validation, bilingual strings) moves unchanged.

**Zero-server option (already built):** a faithful on-device port of this same engine ships as a single static page ("Plates for Hope AI Meal Coordinator — Working App" — see the submission README for its link). It computes entirely in the visitor's browser and saves plans in that browser's storage. It is the fastest way to put the working Coordinator in front of judges and organizers today.

## Configuration example (`.env.example`)
The current build reads **no** environment variables. One name is reserved for the pending Meta layer:

```
# NOT read by the current build. Deployment configuration for the prepared
# Meta Model API layer (server/src/meta.ts; runbook: META-INTEGRATION.md),
# activated after the founder claims the hackathon's $150 Meta Model API
# credits and adds a card to the Meta account.
# Server-side only — never expose these values to browser code.
META_MODEL_API_KEY=
META_MODEL_API_BASE_URL=
META_MODEL_NAME=
```

## Status labels that must survive any deployment
- "Meta AI not connected" stays visible until the Meta Model API layer is implemented and tested.
- Grocery prices are planning estimates, not store prices.
- Allergen safety is never guaranteed; flagged plans require organizer review.
- Plates for Hope: approximately 45 meals served through the founder's direct community efforts (not coordinated through this app); regular service is a goal.

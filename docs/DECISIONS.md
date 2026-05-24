# Decisions

## 2026-05-24 Initial app scaffold

- Created the first application code directly in this repository instead of running `create-next-app --force`, so the existing product/specification Markdown files are preserved.
- Implemented a local shadcn-style component set instead of invoking the shadcn CLI. This keeps the initial dependency surface small while preserving the intended UI conventions.
- Added deterministic core utilities and unit tests for print math, Etsy file partitioning, prompt guardrails, listing copy disclosure, and idempotent credits before wiring real providers.
- Swapped the planned Supabase Auth/Storage boundary to Firebase Auth/Firebase Storage after product direction changed. Stripe, Runware provider calls, Sharp export workers, and persistent Prisma repositories remain the next implementation steps. Placeholder routes and interfaces define the boundaries without pretending production integrations are complete.

## 2026-05-24 Runware GPT Image provider

- Set the production image provider boundary to Runware with AIR model `openai:gpt-image@2`.
- Run `prunaai:p-image@upscale` after generation to produce cleaner, higher-resolution previews before storage.
- Keep `negativePrompt` out of `prunaai:p-image@upscale` requests because the model rejects that parameter; prompt exclusions stay in the generation prompt path.
- Kept provider-specific HTTP request construction under `/lib/ai/providers/runware.ts`.
- Preserved `MockImageProvider` for local tests and cheap UI development.

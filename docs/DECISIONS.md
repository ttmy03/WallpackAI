# Decisions

## 2026-05-24 Initial app scaffold

- Created the first application code directly in this repository instead of running `create-next-app --force`, so the existing product/specification Markdown files are preserved.
- Implemented a local shadcn-style component set instead of invoking the shadcn CLI. This keeps the initial dependency surface small while preserving the intended UI conventions.
- Added deterministic core utilities and unit tests for print math, Etsy file partitioning, prompt guardrails, listing copy disclosure, and idempotent credits before wiring real providers.
- Swapped the planned Supabase Auth/Storage boundary to Firebase Auth/Firebase Storage after product direction changed. Stripe, Runware provider calls, Sharp export workers, and persistent Prisma repositories remain the next implementation steps. Placeholder routes and interfaces define the boundaries without pretending production integrations are complete.

## 2026-05-24 Runware GPT Image provider

- Set the production image provider boundary to Runware with AIR model `openai:gpt-image@2`.
- Generate previews without `prunaai:p-image@upscale`; advanced upscale belongs in the paid export/pack creation path so preview generation stays cheaper and faster.
- Keep `negativePrompt` out of `prunaai:p-image@upscale` requests because the model rejects that parameter; prompt exclusions stay in the generation prompt path.
- Kept provider-specific HTTP request construction under `/lib/ai/providers/runware.ts`.
- Preserved `MockImageProvider` for local tests and cheap UI development.

## 2026-05-29 Production job queue

- Moved Generate and Create Etsy Pack work behind a `JobRunner` boundary so public API routes enqueue jobs instead of performing long-running work.
- Chose Cloud Tasks for production dispatch because it integrates with Google ADC/IAM and Firebase App Hosting without custom signing code.
- Kept Firestore as the source of truth for job status, leases, attempts, and idempotent credit reserve/commit/refund state.
- Preserved a local job adapter for development and tests, with `LOCAL_JOB_AUTOPROCESS=false` available when a test needs to assert enqueue-only behavior.

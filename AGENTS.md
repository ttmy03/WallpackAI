# AGENTS.md

## Repository mission

Build `WallPack AI`, a SaaS app for Etsy sellers to create print-ready digital wall-art packs with AI-generated artwork, ratio exports, mockups, listing copy, and buyer instructions.

## Highest-priority product rules

1. This is not a generic AI image generator. Every feature must support Etsy seller output.
2. Exported print files must use real pixel dimensions, not fake DPI metadata.
3. Etsy digital download constraints must be respected by default: up to 5 files, each under 20 MB.
4. The app must help sellers disclose AI-assisted creation in listing descriptions.
5. Do not include presets that mimic living artists, copyrighted franchises, celebrities, brands, logos, or protected characters.
6. Long-running work must run through jobs/workers. Do not block HTTP routes with generation/export work.
7. Credits must be debited idempotently and refunded on provider failure.
8. The user must see job status, errors, and retry options.

## Tech preferences

- Use Next.js App Router with TypeScript.
- Use server components by default; use client components only for interactive UI.
- Use Tailwind CSS and shadcn/ui for UI components.
- Use Prisma with PostgreSQL.
- Use Firebase Auth and Firebase Storage through adapter boundaries.
- Use Stripe Checkout for subscription purchase and Stripe Billing Portal for subscription management.
- Use an AI provider adapter: `ImageProvider`. Do not scatter Runware-specific calls throughout the codebase.
- Use `sharp` for deterministic image resizing/cropping/export.
- Use a queue/job abstraction: `JobRunner`. Implement a local/dev adapter first if necessary.

## Code quality expectations

- TypeScript strict mode.
- Zod validation for API inputs.
- Unit tests for print math, ratio presets, file-size partitioning, credit ledger idempotency, and prompt guardrails.
- Playwright e2e for signup -> generate -> export -> download path when feasible.
- Do not add unapproved production dependencies without explaining why.
- Keep functions small and business logic in `/lib` or `/server`, not in UI components.
- Public utilities must be documented with concise comments where behavior is non-obvious.

## Folder conventions

Suggested structure:

```txt
app/
  (marketing)/
  (auth)/
  app/
  api/
components/
  app/
  marketing/
  ui/
lib/
  ai/
  billing/
  etsy/
  export/
  image/
  jobs/
  print/
  prompts/
  storage/
  validations/
prisma/
  schema.prisma
scripts/
tests/
  unit/
  e2e/
docs/
```

## Naming conventions

- Product entity: `Project` = a seller's wall-art project.
- `Artwork` = one generated or uploaded source image.
- `GenerationJob` = async creation of image previews.
- `ExportJob` = async creation of print-ready packs.
- `ExportArtifact` = stored downloadable file or generated listing asset.
- `PrintRatioPreset` = reusable ratio definition such as `2x3`, `3x4`, `4x5`.

## Business rules to encode in tests

- 24 x 36 in at 300 DPI = 7200 x 10800 px.
- 18 x 24 in at 300 DPI = 5400 x 7200 px.
- A2 at 300 DPI = 4961 x 7016 px.
- Etsy pack export must never create more than 5 Etsy upload files unless marked `external_delivery_not_recommended`.
- Individual Etsy upload files should target <= 18 MB to leave margin below the 20 MB limit.
- Listing tag generation returns at most 13 tags, each <= 20 characters.
- AI disclosure sentence must be present in generated listing descriptions unless user explicitly disables it after warning.

## UX rules

- Never show only a blank prompt box. Always provide guided presets.
- Use plain language: "Print Size" instead of "DPI metadata".
- Show a warning when a user selects a huge size that may reduce quality.
- Show exact pixel dimensions before export.
- Show file-size warnings before Etsy upload pack creation.
- Provide retry, cancel, and duplicate project actions.

## Security rules

- Never expose provider API keys to the browser.
- Use signed URLs for downloads.
- Store generated files under user-scoped paths.
- Verify Stripe webhook signatures.
- Make all credit/subscription changes idempotent.
- Sanitize filenames before ZIP creation.
- Rate-limit prompt and export endpoints.

## Testing commands

When implemented, run these before considering a task complete:

```bash
npm run lint
npm run typecheck
npm run test
```

If e2e tests exist and the task touches critical flows:

```bash
npm run test:e2e
```

# 16 Codex Tasks

Use these as separate Codex prompts. Run tests after each task.

## Task 1: Create app skeleton

```txt
Create a Next.js App Router TypeScript app for WallPack AI using Tailwind and shadcn/ui. Add strict TypeScript, ESLint, Prettier, Vitest, and a suggested folder structure from AGENTS.md. Add basic marketing, auth placeholder, and app dashboard routes. Do not implement AI or payments yet. Add npm scripts: lint, typecheck, test, test:e2e.
```

Acceptance:

- `npm run lint` passes.
- `npm run typecheck` passes.
- App starts locally.

## Task 2: Add Prisma data model

```txt
Implement the Prisma schema from docs/04_DATA_MODEL.md. Add migrations, Prisma client helper, and seed script that creates style presets only if needed in code. Add model enums as string constants in TypeScript. Add a repository/service layer for User, Project, GenerationJob, Artwork, ExportJob, and CreditLedgerEntry.
```

Acceptance:

- Migration succeeds.
- Prisma client generates.
- Basic repository tests pass.

## Task 3: Implement print math

```txt
Implement print ratio presets and print math utilities from docs/07_PRINT_EXPORT_SPEC.md. Include inchesToPixels, presetToPixels, effectiveDpi, ratio matching, safe filename creation, and unit tests for all canonical ratios.
```

Acceptance:

- Tests verify 2:3 = 7200x10800, 3:4 = 5400x7200, 4:5 = 4800x6000, 5:7 = 6000x8400, 11:14 = 6600x8400, ISO A2 ~= 4961x7016.

## Task 4: Implement prompt presets and guardrails

```txt
Implement style presets, palette presets, prompt builder, and prompt guard service from docs/09_PROMPT_SYSTEM_AND_PRESETS.md. Add Zod schemas for prompt inputs. Block protected franchise, logo, celebrity, and living artist prompts with safe alternative suggestions. Unit test pass/block cases.
```

Acceptance:

- Safe prompt builds complete wall-art prompt.
- Blocked prompt returns structured error and suggestion.
- Tests pass.

## Task 5: Build project wizard

```txt
Build /app/new as a guided wizard: concept, style, palette, composition, generate summary. Use React Hook Form and Zod. Save a Project through API route. Show credit estimate placeholder. Use shadcn/ui cards for presets.
```

Acceptance:

- Authenticated user can create project.
- User sees new project page.
- Validation errors are clear.

## Task 6: Add image provider abstraction

```txt
Create ImageProvider interface and two implementations: MockImageProvider for dev/tests and RunwareImageProvider for production. Keep provider-specific code isolated. Runware provider should read RUNWARE_API_KEY and RUNWARE_AIR_ID from env. Return image bytes, mime type, width, height, provider request id, and usage metadata when available.
```

Acceptance:

- Mock provider returns deterministic test image.
- Runware provider compiles but is not called in tests.
- No API key is exposed client-side.

## Task 7: Implement generation job flow

```txt
Implement generation API route and job service. It should validate project ownership, run prompt guard, create GenerationJob, enqueue a job, call ImageProvider, store source and preview images, create Artwork rows, update status/stage, and handle failures. Use local synchronous job runner in dev if no queue provider configured.
```

Acceptance:

- With mock provider, user can generate preview artworks.
- Job status endpoint works.
- Failure updates job with error code.

## Task 8: Implement credit ledger

```txt
Implement CreditService with grant, reserve, commit, refund, and getBalance. Use idempotency keys. Add free signup credit grant. Wrap generation job execution with reserve/commit/refund. Add unit tests for idempotency and insufficient balance.
```

Acceptance:

- Credits cannot go negative.
- Failed mock generation refunds credits.
- Webhook-like duplicate grants do not double-credit.

## Task 9: Build project editor and crop settings

```txt
Build /app/projects/[id]/editor. Show artwork gallery, selected artwork, focal point control, ratio cards, target pixel dimensions, and crop warnings. Implement RatioCropSetting API and preview rendering helper with Sharp. Persist focal point/crops.
```

Acceptance:

- User can select artwork.
- Ratio previews render for selected artwork.
- Crop settings persist after reload.

## Task 10: Implement export pack service

```txt
Implement ExportPackService. Given selected artwork and ratios, crop/resize to canonical pixels, export progressive JPG with 300 DPI metadata, create buyer instruction PDF, create listing-copy.txt placeholder, create manifest JSON, ZIP outputs into <=18MB target files and <=5 Etsy upload files where possible, store artifacts, update ExportJob.
```

Acceptance:

- Full 5-ratio export works with mock artwork.
- Each print JPG has expected pixel dimensions.
- ZIP splitter respects constraints.
- Export page offers signed download URLs.

## Task 11: Implement listing copy generator

```txt
Implement ListingCopyService. Generate Etsy title, description, and up to 13 tags using deterministic template first; optionally add AI text generation behind adapter later. Validate title <=140 chars, tags <=13 and <=20 chars. Include AI disclosure by default. Save ListingCopy and include listing fields files in export.
```

Acceptance:

- Listing copy passes validators.
- AI disclosure appears by default.
- Copy buttons work in UI.

## Task 12: Implement Stripe billing

```txt
Implement Stripe Checkout subscription route, Billing Portal route, and webhook route. Verify webhook signatures. Store subscription status. Grant credits on invoice.paid idempotently. Add settings/billing page with plan, credits, upgrade, and manage billing buttons.
```

Acceptance:

- Stripe test checkout works.
- Webhook grants credits once.
- Billing portal opens for subscribed user.

## Task 13: Add mockups

```txt
Implement deterministic mockup generation from templates: square framed wall mockup, ratio grid, included files image. Use generated artwork and Sharp composition. Export seller mockups separately from Etsy buyer files unless file budget allows.
```

Acceptance:

- Mockups are at least 2000px wide/high.
- No transparency.
- Mockups are downloadable and included in seller pack.

## Task 14: Add observability and admin support

```txt
Add structured job logs, event tracking abstraction, Sentry integration placeholder, and an admin-only failed jobs page. Include retry and credit refund status. Add global kill switch env var DISABLE_GENERATION.
```

Acceptance:

- Failed jobs visible to admin.
- DISABLE_GENERATION blocks new generation with friendly error.
- Logs include job IDs but no secrets.

## Task 15: Final MVP hardening

```txt
Run through docs/13_QUALITY_ASSURANCE.md. Add missing tests, error states, loading states, empty states, legal page placeholders, and production deployment checklist. Fix type/lint/test failures.
```

Acceptance:

- Critical path passes manually.
- lint/typecheck/test pass.
- Known limitations documented in app help.

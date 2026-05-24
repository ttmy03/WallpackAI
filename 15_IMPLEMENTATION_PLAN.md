# 15 Implementation Plan

## Phase 0: Repository setup

1. Create Next.js app with TypeScript.
2. Add Tailwind and shadcn/ui.
3. Configure ESLint, Prettier, Vitest, Playwright.
4. Add Prisma and Postgres connection.
5. Add Firebase Auth helpers.
6. Add environment variable validation.
7. Add base layout and marketing pages.

Done when:

- App runs locally.
- Typecheck passes.
- Empty test suite runs.
- Auth helper can identify current user.

## Phase 1: Core data and dashboard

1. Implement Prisma schema.
2. Create migrations.
3. Add internal user sync from Firebase user.
4. Build dashboard shell.
5. Build project creation route and UI.
6. Build project list/detail pages.

Done when:

- User can sign in.
- User can create project.
- User sees only own projects.

## Phase 2: Print math and presets

1. Implement print ratio preset constants.
2. Implement inches/mm to pixels.
3. Implement ratio validation.
4. Implement file name sanitizer.
5. Add unit tests.

Done when:

- All preset dimensions test correctly.
- Utility exports are documented.

## Phase 3: Prompt builder and guardrails

1. Add style and palette presets.
2. Add prompt builder service.
3. Add prompt guard service.
4. Add UI wizard steps.
5. Add unit tests for prompt guardrails.

Done when:

- Safe prompts generate final provider prompt.
- Blocked prompts return safer suggestions.

## Phase 4: AI provider adapter

1. Implement `ImageProvider` interface.
2. Implement mock provider for tests/dev.
3. Implement Runware provider adapter.
4. Add generation job model and queue stub.
5. Build generation API route.
6. Build generation progress UI.
7. Store source and previews.

Done when:

- User can generate preview images using mock provider.
- Runware provider can be enabled with env vars.
- Credits can be reserved/refunded in later phase.

## Phase 5: Credits and billing foundation

1. Implement credit ledger service.
2. Add free signup credit grant.
3. Add reserve/commit/refund logic.
4. Wrap generation jobs with credit logic.
5. Add billing/credits settings page.
6. Add unit tests for idempotency.

Done when:

- Generation requires credits.
- Failed generation refunds credits.
- Ledger is auditable.

## Phase 6: Editor and crop previews

1. Build artwork selection UI.
2. Build focal point control.
3. Implement crop settings model CRUD.
4. Generate ratio previews.
5. Show target dimensions and warnings.

Done when:

- User can select an artwork.
- User can preview all ratios.
- Saved crop settings persist.

## Phase 7: Export pack service

1. Implement ratio crop + resize.
2. Export progressive JPG with DPI metadata.
3. Generate buyer PDF.
4. Generate listing copy files.
5. Generate manifest JSON.
6. Implement ZIP builder and size splitting.
7. Upload artifacts to storage.
8. Add export job route and UI.
9. Add tests for file size and presets.

Done when:

- User can export and download Etsy pack.
- Pack respects default Etsy constraints.
- Manifest shows exact dimensions.

## Phase 8: Listing copy and tags

1. Implement listing copy generator.
2. Add validators for title and tags.
3. Add AI disclosure default.
4. Add copy-to-clipboard UI.
5. Add regenerate listing copy action.

Done when:

- Export page shows validated title, tags, description.
- Listing copy file is included in seller pack.

## Phase 9: Stripe subscriptions

1. Create products/prices in Stripe Dashboard.
2. Add checkout session route.
3. Add billing portal route.
4. Add webhook route with signature verification.
5. Update subscription model.
6. Grant monthly credits on invoice paid.
7. Add tests for webhook idempotency.

Done when:

- User can upgrade.
- Paid invoice grants credits once.
- Portal manages subscription.

## Phase 10: QA, polish, launch

1. Add error states.
2. Add Sentry/logging.
3. Add admin job view or database ops guide.
4. Add legal pages.
5. Add sample projects.
6. Run full manual QA checklist.
7. Deploy staging.
8. Deploy production.

Done when:

- End-to-end flow works in production.
- Failed jobs are recoverable.
- Billing live mode tested.
- File exports manually verified.

## Suggested build order for Codex sessions

1. `Setup app, tooling, folders, env validation.`
2. `Implement Prisma schema and auth user sync.`
3. `Implement print presets and tests.`
4. `Implement prompt presets/guardrails and tests.`
5. `Implement project wizard UI.`
6. `Implement mock image provider and generation job flow.`
7. `Implement Runware provider adapter.`
8. `Implement credit ledger.`
9. `Implement editor and crop previews.`
10. `Implement export pack service.`
11. `Implement listing copy generator.`
12. `Implement Stripe billing.`
13. `Add observability and QA polish.`

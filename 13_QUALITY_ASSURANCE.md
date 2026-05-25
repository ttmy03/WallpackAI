# 13 Quality Assurance

## Test strategy

Prioritize tests around print math, credit safety, export file limits, and user ownership. These are the most expensive bugs.

## Unit tests

### Print math

Test:

- inches to pixels.
- preset dimensions.
- ratio matching tolerance.
- effective DPI calculation.
- A-series dimensions.

Examples:

```ts
expect(presetToPixels(PRINT_RATIO_PRESETS['2x3'])).toEqual({ width: 7200, height: 10800 });
expect(presetToPixels(PRINT_RATIO_PRESETS['3x4'])).toEqual({ width: 5400, height: 7200 });
expect(presetToPixels(PRINT_RATIO_PRESETS['4x5'])).toEqual({ width: 4800, height: 6000 });
```

### Crop service

Test:

- centered focal point crop.
- edge focal point clamps inside image.
- crop result matches target ratio.
- crop does not exceed source bounds.

### Export service

Test:

- output file names are safe.
- ZIP splitter respects 18 MB target and 20 MB hard limit.
- max default Etsy ZIP count is <= 5.
- buyer PDF is included.
- manifest is generated.
- quality fallback warns when JPG quality drops below threshold.

### Credits

Test:

- reservation fails with insufficient balance.
- reserve/commit/refund idempotency.
- concurrent reservation does not create negative balance.
- invoice credit grant is idempotent.

### Prompt guardrails

Test:

- block protected franchise prompt.
- block living artist style prompt.
- block logo prompt.
- allow generic style prompt.
- generated prompt includes no text/logo/watermark exclusions.

### Listing copy validation

Test:

- title <= 140 characters.
- tags <= 13.
- each tag <= 20 characters.
- AI disclosure included by default.
- no physical item disclaimer exists.

## Integration tests

- Create project -> enqueue generation -> mock provider returns image -> artwork saved.
- Export selected artwork -> artifacts saved -> signed URLs returned.
- Stripe webhook -> subscription active -> credits reset to the plan's monthly allowance.
- Failed provider job -> credits refunded.

## E2E tests

Use Playwright when the UI exists.

Critical path:

1. Sign up/sign in.
2. Create project.
3. Generate previews with mocked provider.
4. Select preview.
5. Open editor.
6. Save crop.
7. Export pack.
8. Download artifact link visible.
9. Listing copy visible.

## Image quality checks

MVP checks can be simple and deterministic:

### Decode check

- Can image be decoded by Sharp?
- Has width and height?

### Blank image check

- Compute average brightness and variance.
- Warn if variance very low.

### Blur check

- Simple Laplacian/edge variance approximation.
- Warn but do not block unless extreme.

### Upscale factor check

```txt
factor = targetLongEdge / sourceCroppedLongEdge
```

- <= 2: pass.
- > 2 and <= 3: warning.
- > 3: strong warning.

### Artifact review checklist for user

Show final review tips:

- Zoom into details.
- Check edges after crop.
- Avoid files with text-like artifacts.
- Avoid faces/hands unless intentionally generated and checked.
- Confirm colors match intended palette.

## Manual QA checklist before launch

### Generation

- Generate each style preset.
- Confirm prompt blocklist works.
- Confirm credits decrease correctly.
- Confirm refunds on simulated provider failure.

### Export

- Export 2:3 only.
- Export full 5-ratio pack.
- Export with ISO A-series.
- Export with mockups.
- Confirm ZIP count <= 5.
- Confirm each Etsy upload ZIP < 20 MB.
- Open JPG files and inspect dimensions.
- Open PDF buyer instructions.
- Inspect listing copy.

### Billing

- Checkout success.
- Checkout cancel.
- Invoice paid.
- Subscription canceled.
- Webhook replay does not double credits.

### Security

- Try accessing another user's project via URL.
- Try accessing another user's download route.
- Try invalid signed URL.
- Try unauthenticated API calls.

## Acceptance criteria for MVP

- A beta user can generate and export a pack without developer help.
- Generated pack contains real print-size pixel dimensions.
- Etsy upload ZIP files fit 5 x 20 MB default constraint.
- Listing copy validates title/tag limits.
- Credits work consistently under retries.
- Failed jobs are visible and retryable/refundable.

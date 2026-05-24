# 05 API Spec

## Response shape

All routes return:

```ts
type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { code: string; message: string; details?: unknown } };
```

## Auth

All `/api/app/*` routes require authenticated user.
Verify Firebase ID tokens on the server.
Never trust `userId` from client body.

## Project routes

### `POST /api/app/projects`

Create a project.

Request:

```json
{
  "name": "Japandi Mountain Set",
  "promptInputs": {
    "subject": "minimalist mountain landscape",
    "room": "living room",
    "stylePresetKey": "japandi_minimal",
    "paletteKey": "warm_neutral_sage",
    "mood": "calm",
    "composition": "centered with negative space",
    "avoid": ["text", "logos", "watermarks"]
  }
}
```

Response:

```json
{
  "ok": true,
  "data": { "projectId": "clx..." },
  "error": null
}
```

### `GET /api/app/projects`

Query params:

```txt
?page=1&pageSize=20
```

Response includes project cards.

### `GET /api/app/projects/:projectId`

Returns project detail, artworks, generation jobs, latest exports.

### `PATCH /api/app/projects/:projectId`

Update project name or prompt inputs.

## Generation routes

### `POST /api/app/projects/:projectId/generations`

Start a generation job.

Request:

```json
{
  "previewCount": 2,
  "primaryRatio": "2x3",
  "quality": "medium"
}
```

Validation:

- User owns project.
- Prompt passes guardrails.
- User has enough credits.
- Preview count allowed by plan.

Response:

```json
{
  "ok": true,
  "data": { "jobId": "gen_...", "status": "queued" },
  "error": null
}
```

### `GET /api/app/generation-jobs/:jobId`

Returns status and generated artwork IDs if complete.

### `POST /api/app/generation-jobs/:jobId/cancel`

Cancel queued jobs when possible.

### `POST /api/app/generation-jobs/:jobId/retry`

Retry failed retryable jobs. Create a new job row or mark attempt count clearly.

## Artwork routes

### `PATCH /api/app/artworks/:artworkId/select`

Marks artwork as selected for project.

Request:

```json
{ "selected": true }
```

### `PATCH /api/app/artworks/:artworkId/crops`

Save crop settings.

Request:

```json
{
  "ratioKey": "4x5",
  "focalX": 0.52,
  "focalY": 0.48,
  "cropX": 100,
  "cropY": 0,
  "cropWidth": 1800,
  "cropHeight": 2250
}
```

### `GET /api/app/artworks/:artworkId/ratio-preview?ratio=4x5`

Returns signed URL or image bytes for ratio preview.
For MVP, generate previews in export/editor job and store them.

## Export routes

### `POST /api/app/projects/:projectId/exports`

Start export job.

Request:

```json
{
  "artworkId": "art_...",
  "ratios": ["2x3", "3x4", "4x5", "5x7", "11x14"],
  "targetDpi": 300,
  "maxPrintSizeTier": "standard",
  "includeBuyerPdf": true,
  "includeMockups": true,
  "includeListingCopy": true,
  "jpegQuality": 92
}
```

Response:

```json
{
  "ok": true,
  "data": { "exportJobId": "exp_...", "status": "queued" },
  "error": null
}
```

### `GET /api/app/export-jobs/:exportJobId`

Returns status, artifacts, warnings, and signed download URLs if complete.

Do not issue long-lived URLs. Use short-lived signed links.

### `POST /api/app/export-jobs/:exportJobId/retry`

Retry failed export.

## Listing copy routes

### `POST /api/app/export-jobs/:exportJobId/listing-copy/regenerate`

Regenerate listing copy without regenerating print files.

Request:

```json
{
  "tone": "warm_professional",
  "keywords": ["japandi wall art", "neutral printable art", "mountain print"],
  "includeAiDisclosure": true
}
```

Response includes title, tags, description.

### `PATCH /api/app/export-jobs/:exportJobId/listing-copy`

Save user edits.

Validation:

- title <= 140 chars.
- tags <= 13.
- each tag <= 20 chars.

## Billing routes

### `POST /api/billing/create-checkout-session`

Request:

```json
{ "planKey": "pro_monthly" }
```

Response:

```json
{ "ok": true, "data": { "url": "https://checkout.stripe.com/..." }, "error": null }
```

### `POST /api/billing/create-portal-session`

Creates a Stripe Billing Portal session for current user.

### `POST /api/webhooks/stripe`

Webhook events to handle:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Rules:

- Verify Stripe signature.
- Use idempotency table or unique ledger idempotency key.
- Grant monthly credits only once per paid invoice.

## Admin routes

Protect behind admin role.

### `GET /api/admin/jobs?status=failed`

### `POST /api/admin/users/:userId/credits`

Request:

```json
{
  "amount": 20,
  "reason": "manual_support_adjustment"
}
```

## Future Etsy API routes

Do not build in MVP unless explicitly requested.

Potential future routes:

- `GET /api/etsy/connect`
- `GET /api/etsy/callback`
- `POST /api/etsy/listings/draft`
- `POST /api/etsy/listings/:listingId/upload-images`
- `POST /api/etsy/listings/:listingId/upload-files`

Future constraints:

- Needs OAuth token with Etsy `listings_w` scope.
- Digital listings use `type=download`.
- Listing file and image upload must be separate API operations.

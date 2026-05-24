# 03 Tech Stack and Architecture

## Recommended stack

### Frontend

- Next.js App Router.
- TypeScript strict mode.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form + Zod for forms.
- TanStack Query only where client polling/state is needed.

### Backend

- Next.js route handlers for API surface.
- Server actions only for simple authenticated mutations that do not start expensive jobs.
- Prisma ORM with Postgres.
- Firebase Auth for authentication.
- Firebase Storage for artifacts in MVP.

### Jobs

Use a job runner abstraction so the implementation can start simple and evolve:

```ts
interface JobRunner {
  enqueueGeneration(input: GenerationJobInput): Promise<{ jobId: string }>;
  enqueueExport(input: ExportJobInput): Promise<{ jobId: string }>;
}
```

Candidate implementations:

- Trigger.dev for long-running image processing jobs.
- Inngest for event-driven workflow.
- BullMQ + Redis if using a persistent Node worker.
- Local dev adapter that executes jobs directly for tests.

Do not rely on Vercel API route execution for final export jobs. Exports may need resizing several large images, ZIP creation, compression retries, PDF creation, and storage uploads.

### AI providers

Create a provider interface:

```ts
interface ImageProvider {
  generate(input: GenerateImageInput): Promise<GeneratedImage[]>;
  edit?(input: EditImageInput): Promise<GeneratedImage[]>;
}
```

Default provider:

- Runware image inference with OpenAI GPT Image 2, followed by Runware P-Image Upscale.

Provider selection should come from environment variables:

```txt
IMAGE_PROVIDER=runware
RUNWARE_AIR_ID=openai:gpt-image@2
RUNWARE_UPSCALE_AIR_ID=prunaai:p-image@upscale
RUNWARE_UPSCALE_TARGET_MEGAPIXELS=8
```

Add provider-specific logic only under `/lib/ai/providers/runware`.

### Image processing

Use Sharp for:

- decoding images,
- resizing,
- crop generation,
- progressive JPG export,
- metadata/DPI tagging,
- sRGB conversion where supported,
- thumbnails.

Use `archiver` or equivalent for ZIP creation.
Use `pdf-lib` or `pdfkit` for buyer instruction PDFs.

### Storage

Suggested Firebase Storage object paths:

```txt
previews/
  userId/projectId/artworkId/preview.jpg
sources/
  userId/projectId/artworkId/source.png
exports/
  userId/projectId/exportId/wallpack-2x3.zip
mockups/
  userId/projectId/exportId/mockup-1.jpg
```

All downloads use signed URLs. Do not make paid export files public.

## High-level architecture

```txt
Browser
  -> Next.js app routes
  -> API route validates input and auth
  -> DB creates Project / Job rows
  -> JobRunner enqueues async job
  -> Worker calls AI provider / image processor
  -> Worker stores artifacts
  -> Worker updates job status
  -> Browser polls job status or receives realtime update
  -> User downloads signed URL
```

## Async job states

Use shared enum:

```ts
type JobStatus =
  | 'queued'
  | 'validating'
  | 'running'
  | 'processing'
  | 'uploading'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
```

Generation job stages:

1. `queued`
2. `validating_prompt`
3. `debiting_credits`
4. `calling_provider`
5. `saving_previews`
6. `quality_check`
7. `succeeded` or `failed`

Export job stages:

1. `queued`
2. `loading_source_artwork`
3. `building_ratio_variants`
4. `upscaling_or_resizing`
5. `quality_check`
6. `creating_listing_assets`
7. `creating_zip_files`
8. `uploading_artifacts`
9. `succeeded` or `failed`

## Critical services

### `CreditService`

Responsibilities:

- reserve credits before expensive work,
- commit credits on success,
- refund on provider/export failure,
- idempotency by `jobId`,
- never allow negative balances.

### `PromptGuardService`

Responsibilities:

- block protected IP/franchise/celebrity/logo/living-artist prompts,
- normalize prompts,
- attach negative prompt/exclusions,
- produce a safety explanation for the UI.

### `PrintMathService`

Responsibilities:

- convert inches/mm/cm to pixels,
- choose export dimensions,
- calculate effective DPI,
- validate aspect ratios,
- create file names.

### `RatioCropService`

Responsibilities:

- compute crop rectangles using focal point,
- preserve important center area,
- render previews,
- store crop settings.

### `ExportPackService`

Responsibilities:

- build ratio files,
- run compression fallback,
- build buyer PDF,
- build listing copy files,
- split into Etsy-compatible ZIPs,
- write manifest.

### `ListingCopyService`

Responsibilities:

- generate title, description, tags,
- validate Etsy constraints,
- include AI disclosure helper,
- avoid claims such as "guaranteed bestseller".

## Error handling

All async jobs must store:

- machine-readable `errorCode`,
- user-safe `errorMessage`,
- raw provider request id if available,
- retryable boolean,
- credit refund status.

Example error codes:

```txt
PROMPT_BLOCKED
INSUFFICIENT_CREDITS
PROVIDER_RATE_LIMITED
PROVIDER_REJECTED_PROMPT
PROVIDER_TIMEOUT
IMAGE_TOO_SMALL
EXPORT_FILE_TOO_LARGE
STORAGE_UPLOAD_FAILED
ZIP_CREATION_FAILED
STRIPE_WEBHOOK_INVALID
```

## API response pattern

Use consistent JSON:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "PROMPT_BLOCKED",
    "message": "This prompt mentions a protected brand or character. Try a generic description instead.",
    "details": {}
  }
}
```

## Deployment recommendation

MVP:

- Vercel for Next.js UI/API.
- Firebase for auth/storage and Postgres for relational data.
- Trigger.dev/Inngest for jobs.
- Stripe for billing.

If exports become CPU-heavy:

- Move worker to Railway/Fly.io/Render with persistent memory and more CPU.
- Keep API and UI on Vercel.

## Cost-control architecture

- Store provider model and token/cost metadata per job.
- Require credit reservation before calling image provider.
- Limit generation batch size by plan.
- Limit export max print size by plan.
- Use low-res preview generation and high-res export only after selection.
- Add admin kill switch for image generation.

## Extensibility

Future provider adapters:

- `RunwareImageProvider`
- `ReplicateUpscaleProvider`
- `LocalSharpUpscaler`
- `EtsyOpenApiClient`
- `CloudflareR2StorageProvider`

Use interfaces now so future migrations do not rewrite product logic.

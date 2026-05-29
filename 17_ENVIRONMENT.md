# 17 Environment and Local Setup

## Required environment variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3100
NODE_ENV=development

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Firebase client config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK
# Prefer a base64-encoded service account JSON in production secrets.
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_PROJECT_ID=wallpackai
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# AI
IMAGE_PROVIDER=runware
RUNWARE_API_KEY=
RUNWARE_AIR_ID=openai:gpt-image@2
RUNWARE_UPSCALE_AIR_ID=prunaai:p-image@upscale
RUNWARE_UPSCALE_TARGET_MEGAPIXELS=8
RUNWARE_API_URL=https://api.runware.ai/v1
DISABLE_GENERATION=false

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_STARTER_ID=
STRIPE_PRICE_STUDIO_ID=
STRIPE_PRICE_BATCH_ID=

# Jobs
JOB_RUNNER=local
CREDIT_LEDGER_PROVIDER=firestore
CLOUD_TASKS_PROJECT_ID=wallpackai
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=wallpack-jobs
JOB_WORKER_BASE_URL=http://localhost:3100
JOB_WORKER_SECRET=
GENERATION_JOB_TIMEOUT_MS=1500000
EXPORT_JOB_TIMEOUT_MS=900000
LOCAL_JOB_AUTOPROCESS=true

# Storage
STORAGE_PROVIDER=firebase
EXPORT_SIGNED_URL_TTL_SECONDS=900

# Admin
ADMIN_EMAILS=you@example.com
```

## Local setup steps

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

Local API routes verify Firebase ID tokens and read Firestore through Firebase
Admin. For local development, either set `FIREBASE_SERVICE_ACCOUNT_JSON` to a
service account JSON value/base64 value, or authenticate Application Default
Credentials for the `wallpackai` project before starting `npm run dev`.

Suggested scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  }
}
```

## Development modes

### Mock mode

Use for UI and tests:

```bash
IMAGE_PROVIDER=mock
JOB_RUNNER=local
```

Mock provider should generate a deterministic gradient or fixture image so exports can be tested cheaply. Local jobs are enqueued and then dispatched by the local job adapter. Set `LOCAL_JOB_AUTOPROCESS=false` when testing that enqueue does not execute work immediately.

### Cloud Tasks production jobs

Use in production so Generate and Create Etsy Pack jobs survive browser closes
and do not depend on the public API request lifecycle:

```bash
JOB_RUNNER=cloud-tasks
CLOUD_TASKS_PROJECT_ID=wallpackai
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=wallpack-jobs
JOB_WORKER_BASE_URL=https://wallpackai-web--wallpackai.europe-west4.hosted.app
JOB_WORKER_SECRET=...
GENERATION_JOB_TIMEOUT_MS=1500000
EXPORT_JOB_TIMEOUT_MS=900000
```

Create the queue in `europe-west1`. App Hosting serves the app from
`europe-west4`, but Cloud Tasks does not currently offer that region:

```bash
gcloud tasks queues create wallpack-jobs \
  --project wallpackai \
  --location europe-west1
```

Grant the App Hosting runtime service account permission to enqueue Cloud
Tasks, and store `JOB_WORKER_SECRET` as a server-only secret. Cloud Tasks calls
`/api/internal/jobs/generation/{jobId}` or `/api/internal/jobs/export/{jobId}`;
those routes reject requests without `X-WallPack-Job-Secret`.

### Runware mode

Use only when ready:

```bash
IMAGE_PROVIDER=runware
RUNWARE_API_KEY=...
RUNWARE_AIR_ID=openai:gpt-image@2
RUNWARE_UPSCALE_AIR_ID=prunaai:p-image@upscale
# Optional async polling overrides:
# RUNWARE_POLL_TIMEOUT_MS=600000
# RUNWARE_POLL_INTERVAL_MS=1500
# RUNWARE_POLL_MAX_INTERVAL_MS=7500
```

Keep provider calls server-side.

### Disabled mode

For emergency cost control:

```bash
DISABLE_GENERATION=true
```

API should return:

```txt
Image generation is temporarily unavailable. Existing exports are still accessible.
```

## Stripe local webhook

Use Stripe CLI:

```bash
stripe listen --forward-to localhost:3100/api/stripe/webhook
```

Copy webhook signing secret into `.env.local`.

## Firebase Storage

Use a private Firebase Storage bucket and store generated files under user-scoped paths:

```txt
previews/{userId}/{projectId}/{artworkId}/preview.jpg
sources/{userId}/{projectId}/{artworkId}/source.png
exports/{userId}/{projectId}/{exportId}/wallpack-2x3.zip
mockups/{userId}/{projectId}/{exportId}/mockup-1.jpg
```

Storage rules/policies:

- no public read,
- server-side Firebase Admin SDK writes,
- signed URL downloads only.

## Production checklist

- Set live Stripe keys.
- Set webhook endpoint and secret.
- Set Runware API key.
- Set Firebase service account credentials.
- Configure database backups.
- Configure storage lifecycle/retention.
- Set admin email.
- Set `IMAGE_PROVIDER=runware`.
- Set `JOB_RUNNER` to production worker provider.
- Verify `NEXT_PUBLIC_APP_URL` uses production domain.
- Run seed/migrations.
- Run smoke test.

# Firebase App Hosting

This project is a Next.js App Router app with API routes, so Firebase App Hosting is the Firebase deployment target. Classic Firebase Hosting alone is only for static hosting and is not enough for this app.

## Current Status

- Firebase CLI is installed.
- `.firebaserc` points to `wallpackai`.
- `firebase use` returns `wallpackai`.
- The Firebase Web app exists:
  `1:352267033614:web:96670cd407b5092682305f`
- `apphosting.yaml` is present.
- App Hosting backend exists:
  `projects/wallpackai/locations/europe-west4/backends/wallpackai-web`
- Backend URL:
  `https://wallpackai-web--wallpackai.europe-west4.hosted.app`
- `NEXT_PUBLIC_APP_URL` is set in `apphosting.yaml` to the Backend URL.
- Firebase Auth uses Google sign-in only.
- GitHub repo exists and is pushed:
  `https://github.com/ttmy03/WallpackAI`
- GitHub is connected to the App Hosting backend through Developer Connect:
  `ttmy03/WallpackAI`
- First build is ready:
  `build-2026-05-24-000`
- First rollout succeeded and the App Hosting URL returns `HTTP 200`.
- Cloud Firestore default database exists:
  `projects/wallpackai/databases/(default)`
- Firestore location:
  `europe-west4`
- Firestore delete protection is enabled.
- Firestore rules and indexes are managed from:
  `firestore.rules` and `firestore.indexes.json`

## GitHub Repository Connection

The repository is already connected. If it needs to be reconnected later, use Firebase Console:

1. Open App Hosting for project `wallpackai`.
2. Open backend `wallpackai-web`.
3. Go to deployment/source settings.
4. Connect GitHub.
5. Install/authorize the Firebase GitHub App for `ttmy03/WallpackAI`.
6. Select repository `ttmy03/WallpackAI`.
7. Select live branch `main`.
8. Keep root directory as `/`.

For future manual rollouts from the `main` branch:

```bash
firebase apphosting:rollouts:create wallpackai-web \
  --project wallpackai \
  --git-branch main \
  --force
```

If this command returns `HTTP Error: 409, unable to queue the operation`, Firebase already has a build or rollout operation queued for the backend. Check the backend in Firebase Console and wait for the active build to finish before starting another rollout.

Add runtime secrets in the Firebase App Hosting console or with Secret Manager. Do not commit these to git:

```txt
DATABASE_URL
DIRECT_URL
RUNWARE_API_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_ID
STRIPE_PRICE_STUDIO_ID
STRIPE_PRICE_BATCH_ID
JOB_WORKER_SECRET
```

The Stripe price secret names must match the plan keys used by the app:
`starter`, `studio`, and `batch`. Do not use legacy names such as
`STRIPE_PRICE_PRO_ID`; the checkout route does not read them.

## Local Checks Before Rollout

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Notes

Firebase App Hosting supports `apphosting.yaml` for runtime settings and environment variables. Public `NEXT_PUBLIC_*` Firebase values are checked in because they are browser configuration, not server secrets. Private keys and provider keys must stay in Firebase-managed secrets.

App Hosting connects GitHub through Google Cloud Developer Connect and the Firebase GitHub App. That OAuth/GitHub App authorization flow is browser-based and cannot be completed purely by committing files to this repo.

## Firebase Auth Google Sign-In

WallPack AI uses Google as the only Firebase Auth sign-in provider:

1. Open Firebase Console for project `wallpackai`.
2. Go to Authentication > Sign-in method.
3. Enable Google.
4. Go to Authentication > Settings > Authorized domains.
5. Add `wallpackai-web--wallpackai.europe-west4.hosted.app`.

## Firestore Persistence

WallPack AI now uses Firestore for account-scoped app metadata:

```txt
users/{firebaseUid}
projects/{projectId}
generationJobs/{jobId}
mockupJobs/{jobId}
artworks/{artworkId}
creditLedgerEntries/{entryId}
```

Firebase Auth remains the source of identity. Server routes verify the Firebase
ID token, upsert `users/{firebaseUid}`, and then read/write Firestore documents
with `userId = firebaseUid`.

Generated image bytes are not stored in Firestore. Source images are uploaded to
Firebase Storage under user-scoped paths, and Firestore stores storage paths,
dimensions, job status, errors, and retry metadata.

Optional seller mockups are also job-backed. `mockupJobs/{jobId}` stores status,
image metadata, and the seller-only ZIP artifact. Mockup image bytes and ZIPs
are stored under `mockups/{userId}/{projectId}/{jobId}/`.

## Production Job Queue

Production jobs use Cloud Tasks:

```txt
JOB_RUNNER=cloud-tasks
CLOUD_TASKS_PROJECT_ID=wallpackai
CLOUD_TASKS_LOCATION=europe-west1
CLOUD_TASKS_QUEUE=wallpack-jobs
JOB_WORKER_BASE_URL=https://wallpackai-web--wallpackai.europe-west4.hosted.app
JOB_WORKER_SECRET=<Secret Manager secret>
```

Create the queue in `europe-west1`. App Hosting serves the app from
`europe-west4`, but Cloud Tasks does not currently offer that region:

```bash
gcloud tasks queues create wallpack-jobs \
  --project wallpackai \
  --location europe-west1
```

Grant the App Hosting runtime service account `roles/cloudtasks.enqueuer`.
Cloud Tasks dispatches one persisted Firestore job to an internal worker route,
which validates `X-WallPack-Job-Secret`, claims the queued job with a Firestore
lease, and then updates Firestore status through completion or failure.
Current worker kinds are `generation`, `export`, and `mockup`.

Firestore client writes are denied by rules. The Next.js server writes through
Firebase Admin after token verification. Authenticated users may read their own
documents if a future client-side reader is added.

Deploy Firestore rules and indexes with:

```bash
firebase deploy --only firestore --project wallpackai --non-interactive
```

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
- GitHub repo exists and is pushed:
  `https://github.com/ttmy03/WallpackAI`

The backend is not connected to GitHub yet. `firebase apphosting:rollouts:create wallpackai-web --git-branch main` currently returns:

```txt
Backend wallpackai-web is missing a connected repository.
```

Firebase says the repository must be connected through the Firebase Console.

## Connect GitHub Repository

In Firebase Console:

1. Open App Hosting for project `wallpackai`.
2. Open backend `wallpackai-web`.
3. Go to deployment/source settings.
4. Connect GitHub.
5. Install/authorize the Firebase GitHub App for `ttmy03/WallpackAI`.
6. Select repository `ttmy03/WallpackAI`.
7. Select live branch `main`.
8. Keep root directory as `/`.

After the repository is connected, create a rollout:

```bash
firebase apphosting:rollouts:create wallpackai-web \
  --project wallpackai \
  --git-branch main \
  --force
```

Add runtime secrets in the Firebase App Hosting console or with Secret Manager. Do not commit these to git:

```txt
DATABASE_URL
DIRECT_URL
RUNWARE_API_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

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

# Firebase App Hosting

This project is a Next.js App Router app with API routes, so Firebase App Hosting is the Firebase deployment target. Classic Firebase Hosting alone is only for static hosting and is not enough for this app.

## Current Status

- Firebase CLI is installed.
- `.firebaserc` points to `wallpackai`.
- `firebase use` returns `wallpackai`.
- The Firebase Web app exists:
  `1:352267033614:web:67390d78d670ca5982305f`
- `apphosting.yaml` is present.

The project is not deploy-ready until `wallpackai` is upgraded to Blaze. The Firebase CLI currently fails while enabling `firebaseapphosting.googleapis.com` because App Hosting requires pay-as-you-go billing.

Upgrade URL:

```txt
https://console.firebase.google.com/project/wallpackai/usage/details
```

## After Blaze Is Enabled

Create the backend:

```bash
firebase apphosting:backends:create \
  --project wallpackai \
  --backend wallpackai-web \
  --primary-region europe-west1 \
  --root-dir . \
  --app 1:352267033614:web:67390d78d670ca5982305f \
  --non-interactive
```

Then add runtime secrets in the Firebase App Hosting console or with Secret Manager. Do not commit these to git:

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

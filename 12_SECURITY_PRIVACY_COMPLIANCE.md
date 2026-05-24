# 12 Security, Privacy, and Compliance

## Security principles

- Never expose API keys in browser code.
- Use server-side calls for AI providers, Stripe, storage, and Etsy future integration.
- Validate every API input with Zod.
- Use ownership checks on every project, artwork, job, and artifact access.
- Use short-lived signed URLs for downloads.
- Rate-limit generation and export endpoints.
- Store only necessary user data.

## Authentication

Use Firebase Auth.

Server-side helper must return internal `User` row mapped from Firebase `uid`.

Do not accept `userId` in request body.

## Authorization

Every query must include authenticated internal `user.id`.

Example:

```ts
const project = await prisma.project.findFirst({
  where: { id: projectId, userId: currentUser.id }
});
if (!project) throw new NotFoundError();
```

## Storage security

- Store all generated files in private buckets.
- Use path prefix `{userId}/{projectId}/...`.
- Validate path ownership before creating signed URL.
- Signed URLs should expire quickly, for example 15 minutes.
- Do not allow arbitrary file path input from client.

## Prompt/content abuse prevention

Block prompts that request:

- trademarked logos,
- protected characters/franchises,
- celebrity likenesses,
- living artist imitation,
- sexual content/nudity as default app category,
- hateful or violent content,
- illegal content.

This app is for printable wall art, so keep the content scope narrow.

## Intellectual property risk controls

- Do not provide brand/character presets.
- Use generic style language.
- Add UI warning: seller is responsible for rights and Etsy compliance.
- Keep audit record of user prompt and generated output metadata.
- Provide safe rewrite suggestions instead of just blocking.

## Etsy AI disclosure

Generated listing descriptions should include AI disclosure by default.

Recommended wording:

```txt
This artwork was created with the assistance of AI tools and was curated, edited, and prepared as a finished digital design by the seller.
```

UI warning if user removes disclosure:

```txt
Etsy expects sellers to disclose AI-assisted creations in listing descriptions. Remove this only if it does not apply to your item.
```

## Privacy policy requirements

Policy should cover:

- account data,
- prompt data,
- generated images,
- payment processor data,
- analytics events,
- support communications,
- retention and deletion,
- subprocessors.

## Data retention

Suggested defaults:

- Previews: 30 days for free users, 90 days for paid users.
- Paid exports: 30-180 days depending plan.
- Logs: 30 days unless required longer for fraud/security.
- Credit ledger and billing metadata: retain for accounting/legal needs.

Provide delete project action.

## Secrets

Required secrets:

- `RUNWARE_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PRIVATE_KEY`
- `DATABASE_URL`

Never log secrets.

## Stripe security

- Verify webhook signatures.
- Store `stripeCustomerId` and `stripeSubscriptionId`, not card data.
- Use Stripe-hosted Checkout and Portal.
- Make webhook processing idempotent.

## Future Etsy integration security

When Etsy OAuth is implemented:

- Encrypt access and refresh tokens at rest.
- Store scope and expiry.
- Use least required scopes.
- Allow user to disconnect Etsy.
- Never publish live without seller confirmation.

## Legal pages to create

- Terms of Service.
- Privacy Policy.
- Refund/Credit Policy.
- AI Use and Etsy Disclosure Guide.
- Copyright/IP Policy.

## Disclaimer copy

Use in app footer or export page:

```txt
WallPack AI helps prepare digital art and listing assets. You are responsible for reviewing final files, ensuring you have rights to your content, and complying with Etsy policies and applicable laws.
```

## Security tests

- User cannot access another user's project.
- User cannot download another user's artifact.
- Prompt route rate limit triggers.
- Stripe webhook rejects invalid signatures.
- Credit ledger idempotency prevents double grants.
- File names are sanitized before ZIP.

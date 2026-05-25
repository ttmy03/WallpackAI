# 11 Payments and Credits

## Payment model

Use subscriptions plus credits. Avoid unlimited generation because image generation/export has variable provider and compute cost.

## Suggested beta pricing

These prices are placeholders and should be validated.

| Plan | Monthly price | Credits | Intended user |
|---|---:|---:|---|
| Free | $0 | 6 one-time preview credits | Test the workflow |
| Starter | $9/mo | 40 credits/mo | Beginner seller |
| Pro | $19/mo | 120 credits/mo | Active Etsy seller |
| Studio | $49/mo | 400 credits/mo | High-volume seller |

## Credit costs

Suggested beta costs:

| Action | Credits |
|---|---:|
| Generate 1 draft preview | 1 |
| Generate 1 standard preview | 2 |
| Generate 1 premium preview | 3 |
| Export Etsy pack standard | 5 |
| Regenerate listing copy | 0 or 1 |
| Advanced upscale add-on | 3 per ratio |

MVP can simplify:

- 2 preview images = 4 credits.
- 1 Etsy export pack = 5 credits.

## Stripe implementation

Use Stripe Checkout for plan purchase and Stripe Customer Portal for subscription management.

### Checkout flow

1. User clicks plan.
2. Server creates Checkout Session with `mode=subscription`.
3. User pays on Stripe-hosted checkout.
4. Stripe webhook receives `checkout.session.completed` and subscription events.
5. App updates subscription status.
6. On `invoice.paid`, grant monthly credits using idempotency key.

### Portal flow

1. User clicks `Manage billing`.
2. Server creates Billing Portal session.
3. User manages payment method, subscription cancellation, invoice downloads on Stripe.

## Stripe webhook events

Handle at minimum:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

## Credit ledger rules

### Reserve/commit/refund

For generation/export jobs:

1. Reserve credits when job starts.
2. Commit reserve when successful.
3. Refund reserve if provider/job fails.

This allows consistent UX and prevents race conditions.

### Idempotency

Every credit movement must have unique `idempotencyKey`.

Examples:

```txt
subscription:grant:invoice_in_123
export:reserve:exp_123
export:commit:exp_123
export:refund:exp_123
```

### Negative balance

Never allow negative balance unless an admin-specific debt mode is explicitly built. MVP should reject actions when balance is insufficient.

## Plan limits

| Limit | Free | Starter | Pro | Studio |
|---|---:|---:|---:|---:|
| Preview batch size | 1 | 2 | 4 | 4 |
| Concurrent jobs | 1 | 1 | 2 | 4 |
| Max standard exports/month | credits-based | credits-based | credits-based | credits-based |
| Advanced upscale | no | add-on | yes limited | yes |
| Stored export duration | 7 days | 30 days | 90 days | 180 days |

## Cost controls

- Require login before generation.
- Use credits for all expensive operations.
- Limit concurrent jobs per user.
- Add daily spend cap per account.
- Add admin global kill switch.
- Store provider usage/cost metadata.
- Watermark free previews.
- Do not export full print packs for free users unless using free credits intentionally.

## Refund policy guidance

Because this is a digital generation service:

- Provide automatic credit refund for technical failure.
- Do not auto-refund successful generations just because the user dislikes the image.
- Consider goodwill support credits.
- Make terms clear.

## Billing UI

Show:

- current plan,
- credit balance,
- renewal date,
- recent credit activity,
- upgrade button,
- manage billing button.

## Edge cases

### Payment succeeds but webhook delayed

Show `Payment processing` and poll subscription state. Also provide a manual sync route for the user.

### User cancels subscription

Keep current credits until period end or according to policy. New monthly credits stop after cancellation takes effect.

### Invoice payment fails

Set subscription `past_due`. Disable new paid generation unless grace period is implemented.

### Plan downgrade

Apply at next billing period through Stripe Portal unless custom handling is implemented.

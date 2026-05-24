# 21 Launch and Beta Checklist

## Pre-beta product checklist

- [ ] User can sign up and sign in.
- [ ] User receives free credits once.
- [ ] User can create a project.
- [ ] User can generate previews with mock provider.
- [ ] User can generate previews with production provider.
- [ ] User can select an artwork.
- [ ] User can preview all ratio crops.
- [ ] User can export full Etsy pack.
- [ ] Export includes buyer PDF.
- [ ] Export includes listing copy and tags.
- [ ] Export includes manifest.
- [ ] Export ZIP files stay under Etsy default limits.
- [ ] User can download signed URLs.
- [ ] Stripe test checkout works.
- [ ] Stripe webhooks update subscription and grant credits.
- [ ] Failed jobs refund credits.

## Print-file QA checklist

For each canonical ratio:

- [ ] Open file locally.
- [ ] Confirm dimensions.
- [ ] Confirm no unintended border unless user selected border.
- [ ] Confirm no frame/mockup in print file.
- [ ] Confirm no watermark/signature.
- [ ] Confirm file size.
- [ ] Confirm color profile/metadata where supported.

Expected dimensions:

```txt
2:3     7200 x 10800 px
3:4     5400 x 7200 px
4:5     4800 x 6000 px
5:7     6000 x 8400 px
11:14   6600 x 8400 px
A2      4961 x 7016 px
```

## Etsy manual upload QA

Create a private/test Etsy listing manually:

- [ ] Upload mockup listing images.
- [ ] Paste title.
- [ ] Paste description.
- [ ] Paste tags.
- [ ] Upload ZIP files.
- [ ] Confirm no ZIP exceeds 20 MB.
- [ ] Confirm no more than 5 digital files.
- [ ] Confirm file names are readable.
- [ ] Confirm buyer PDF explains ratios.

## Billing QA

Stripe test mode:

- [ ] New subscription.
- [ ] Successful invoice.
- [ ] Failed payment.
- [ ] Cancellation.
- [ ] Webhook replay.
- [ ] Portal session.
- [ ] Duplicate invoice event does not double-grant credits.

## Security QA

- [ ] Unauthenticated user cannot call app APIs.
- [ ] User A cannot view User B projects.
- [ ] User A cannot download User B artifact.
- [ ] Stripe webhook rejects invalid signature.
- [ ] API keys are not in client bundle.
- [ ] Storage buckets are private.
- [ ] Signed URLs expire.
- [ ] Rate limits work.

## Content/policy QA

- [ ] Protected brand prompt blocked.
- [ ] Protected character prompt blocked.
- [ ] Living artist style prompt blocked.
- [ ] Logo prompt blocked.
- [ ] Safe generic prompt allowed.
- [ ] AI disclosure included by default.
- [ ] User warning appears if disclosure removed.

## Beta invite process

Ideal first beta users:

- Etsy sellers already selling digital downloads.
- People who understand listing upload flow.
- Sellers willing to report print/file problems.

Beta survey questions:

1. Did the exported ZIP upload to Etsy without changes?
2. Which ratio files did you actually need?
3. Did the buyer PDF make sense?
4. Were mockups useful enough?
5. Did you edit the listing copy?
6. What style presets are missing?
7. Would you pay monthly or per pack?
8. What output quality problems did you see?

## Launch copy checklist

- [ ] Do not claim guaranteed Etsy sales.
- [ ] Do not claim copyright/legal safety.
- [ ] Do not claim official Etsy partnership unless true.
- [ ] Say `Etsy-ready` not `Etsy-approved`.
- [ ] Say `AI-assisted` honestly.
- [ ] Explain credits clearly.

## Production readiness

- [ ] Database backups enabled.
- [ ] Error tracking enabled.
- [ ] Job timeout monitor enabled.
- [ ] Admin kill switch tested.
- [ ] Support email active.
- [ ] Terms/Privacy/Refund Policy published.
- [ ] Domain configured.
- [ ] Stripe live webhook configured.
- [ ] Runware usage limits monitored.
- [ ] Storage lifecycle policy configured.

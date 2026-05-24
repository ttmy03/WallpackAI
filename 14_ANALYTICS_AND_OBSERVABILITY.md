# 14 Analytics and Observability

## Why analytics matter

This product depends on conversion from preview to export. Track where users drop off and which styles produce paid exports.

## Product events

Use a simple event tracker abstraction.

```ts
track(userId, eventName, properties)
```

### Acquisition/activation

```txt
signup_started
signup_completed
onboarding_started
onboarding_completed
project_created
first_generation_started
first_generation_completed
first_export_completed
```

### Generation

```txt
generation_started
generation_succeeded
generation_failed
generation_cancelled
prompt_blocked
artwork_selected
```

Properties:

- stylePresetKey.
- paletteKey.
- previewCount.
- provider.
- model.
- creditCost.
- failureCode.

### Export

```txt
export_started
export_succeeded
export_failed
export_download_clicked
export_file_too_large_warning
quality_warning_shown
advanced_upscale_selected
```

Properties:

- ratios.
- targetDpi.
- exportBytesTotal.
- zipCount.
- maxUpscaleFactor.
- warningCount.

### Billing

```txt
checkout_started
checkout_completed
subscription_activated
subscription_cancelled
credits_exhausted
upgrade_prompt_shown
```

## Core metrics

- Signup to first generation.
- First generation to artwork selected.
- Artwork selected to export started.
- Export started to export succeeded.
- Export succeeded to download clicked.
- Free to paid conversion.
- Credits consumed per active user.
- Cost per exported pack.
- Failed job rate by provider/model.
- Average job duration.

## Operational logs

Log structured JSON for:

- job started/completed/failed,
- provider request id,
- storage upload failure,
- credit ledger error,
- Stripe webhook event handling,
- ZIP file size decisions.

Never log:

- API keys,
- Stripe secrets,
- full auth tokens,
- raw private download URLs beyond debugging redaction.

## Job monitoring

Dashboard/admin should show:

- queued jobs,
- running jobs,
- failed jobs,
- provider errors,
- average duration,
- stuck jobs older than threshold.

Stuck job policy:

- If `running` longer than provider timeout + buffer, mark `failed` with `JOB_TIMEOUT`.
- Refund reserved credits if no successful output.

## Error reporting

Use Sentry or equivalent.

Tag errors with:

- route,
- jobId,
- userId hash,
- provider,
- model,
- errorCode.

## Cost reporting

Store provider usage/cost metadata when available.

Daily admin report:

- generated previews count,
- export count,
- estimated provider cost,
- revenue,
- credit liabilities,
- failed/refunded credits.

## Privacy

Allow users to opt out of marketing analytics where required.
Product-critical operational events can remain if covered in privacy policy.

# 01 MVP Scope

## Build first

### 1. Auth and dashboard

- Email/password or magic-link auth through Firebase Auth.
- Basic dashboard with projects, credits, recent exports.
- Settings page with billing and account deletion request placeholder.

### 2. Guided artwork generator

Wizard fields:

- Subject/theme.
- Room/use case: nursery, living room, office, bedroom, kitchen, meditation room, dorm, seasonal.
- Style preset.
- Color palette.
- Mood.
- Composition: centered subject, landscape, abstract pattern, gallery-set style, negative space.
- Exclusions: text, logos, people, hands, watermarks, signatures.
- Ratio preference: primary output ratio.

MVP should generate 2-4 previews per job, depending on plan/credit cost.

### 3. Project editor

- Preview gallery.
- Select winning artwork.
- Focal point selector.
- Ratio previews for `2:3`, `3:4`, `4:5`, `5:7`, `11:14`.
- Optional ISO A-series toggle.
- Quality warnings.

### 4. Etsy export pack

Export one high-resolution JPG per selected ratio:

- `2x3.jpg`: supports 4x6, 8x12, 12x18, 16x24, 20x30, 24x36.
- `3x4.jpg`: supports 6x8, 9x12, 12x16, 15x20, 18x24.
- `4x5.jpg`: supports 4x5, 8x10, 12x15, 16x20.
- `5x7.jpg`: supports 5x7, 10x14, 15x21, 20x28.
- `11x14.jpg`: supports 11x14 and 22x28.

Optionally include `A-series.jpg` for A5/A4/A3/A2 if file budget allows.

Export extras:

- `README_BUYER_INSTRUCTIONS.pdf`.
- `listing-copy.txt`.
- `etsy-tags.csv`.
- `mockup-1.jpg`, `mockup-2.jpg`, `mockup-3.jpg`.
- `file_manifest.json` for debugging/support.

### 5. Etsy file-size guardrails

The export pack builder must:

- Target <= 18 MB per ZIP/digital upload file.
- Never exceed 5 Etsy upload files in default mode.
- Use progressive JPG compression and quality fallback.
- Show a warning if user chooses too many extras.
- Prefer one high-res master per ratio instead of duplicating every print size.

### 6. Listing asset generator

Generate:

- Title <= 140 characters.
- Up to 13 tags, each <= 20 characters.
- Description with files included, print sizes, download instructions, no physical item disclaimer, AI disclosure helper.
- Optional shop-style tone.

### 7. Stripe subscriptions and credits

- Free preview credits on signup.
- Paid plans with monthly credits.
- Pay-as-you-go top-up optional after core subscription works.
- Webhook-based subscription status updates.
- Idempotent credit ledger.

### 8. Basic admin visibility

- View users, jobs, failed jobs, credits manually in database or a protected admin route.
- Manual refund credit script.

## Do not build in MVP

- Direct Etsy publishing.
- Full Etsy OAuth integration.
- Print-on-demand fulfillment.
- Marketplace of presets.
- Mobile app.
- Team accounts.
- Custom model training.
- Complex vectorization.
- Guaranteed trademark/copyright checking.
- Bulk 100-pack generation.
- Physical product shipping.
- AI-generated typography/quote art as core flow. Text in generated images is error-prone and high-support.

## MVP boundary

The app creates a downloadable product pack. The seller manually uploads files and listing assets to Etsy.

This is the safest first release because direct Etsy publishing adds OAuth, API approval, file upload edge cases, and extra support burden.

## Beta constraints

During beta:

- Limit max exports per day per user.
- Limit max concurrent jobs per user.
- Store generated files for 30 days unless user deletes earlier.
- Watermark previews only, not paid exports.
- Keep an audit trail of prompt, model, job cost, and export settings.

## Launch checklist

- Legal pages: Terms, Privacy, Refund Policy, AI Disclosure Guide.
- Landing page with before/after workflow.
- Pricing page with credit explanation.
- Support email.
- Error reporting.
- Stripe live mode tested.
- PostgreSQL backup policy configured.
- Storage lifecycle policy configured.
- Abuse/rate limits enabled.

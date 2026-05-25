# 02 User Flows

## Flow A: First-time seller creates first pack

1. User lands on marketing page.
2. Clicks `Create my first wall art pack`.
3. Signs up.
4. Sees onboarding modal:
   - shop niche,
   - preferred style,
   - typical buyer,
   - color palette,
   - whether they want AI disclosure included automatically.
5. Lands on `/app/new`.
6. Chooses template: `Printable Wall Art Pack for Etsy`.
7. Enters concept, for example: `minimalist beige mountain landscape for Japandi living room`.
8. Chooses style preset: `Japandi Minimal`.
9. Chooses color palette: `warm beige, ivory, charcoal, muted sage`.
10. Chooses primary ratio: `2:3 poster`.
11. Clicks `Generate preview`.
12. Job starts and credits are reserved.
13. UI shows progress with states:
    - validating prompt,
    - generating images,
    - saving previews,
    - checking quality.
14. User selects a preview.
15. User adjusts focal point and sees ratio previews.
16. User clicks `Create Etsy Pack`.
17. Export job starts.
18. App shows exact files to be created and estimated Etsy upload files.
19. User downloads final ZIP(s).
20. User opens listing copy and uploads files to Etsy manually.

## Flow B: User creates a variation from guided presets

1. User starts a new project.
2. The app pre-fills guided defaults for:
   - style preset,
   - palette,
   - exclusions,
   - ratio pack settings,
   - listing description structure.
3. User changes only subject/theme.
5. Generates new previews.
6. Exports pack.

## Flow C: Export quality issue

1. Export job completes with warning: `Some details may appear soft at 24x36.`
2. UI shows:
   - recommended max print size,
   - affected ratios,
   - option to re-export at smaller max size,
   - option to use high-quality upscale credit.
3. User chooses `Re-export at safer size` or `Use advanced upscale`.
4. Credit debit follows selected path.

## Flow D: File too large for Etsy

1. Export job estimates one output ZIP will exceed 20 MB.
2. Pack builder attempts compression fallback.
3. If still large, it splits into up to 5 ZIP files.
4. If still impossible, UI shows:
   - remove PNG extras,
   - reduce max print size,
   - exclude mockups from Etsy upload files,
   - download a local full pack separately.
5. Default Etsy upload files remain within 5 files and 20 MB each.

## Flow E: Billing upgrade

1. User runs out of credits.
2. UI explains credits required.
3. User clicks `Upgrade`.
4. Stripe Checkout opens.
5. Stripe webhook sets subscription active and resets credits to the plan's monthly allowance.
6. User returns to project and continues export.

## Flow F: Prompt blocked

1. User enters `Disney princess in Ghibli style`.
2. Prompt guardrail detects protected franchise and living/known studio style issue.
3. UI does not send it to the image provider.
4. UI suggests generic alternatives:
   - `whimsical fairytale princess-inspired wall art`.
   - `soft hand-painted animation-inspired style`.
5. User edits prompt and retries.

## Flow G: Manual crop adjustment

1. User sees a 5:7 crop cutting off key subject.
2. User opens crop editor.
3. Drags focal point or crop window.
4. The app updates preview using same source image.
5. User saves ratio adjustments.
6. Export job uses saved crop rectangles.

## Flow H: Listing copy editing

1. After export, user opens listing copy panel.
2. App shows editable fields:
   - title,
   - description,
   - tags,
   - materials,
   - occasion/use cases,
   - AI disclosure.
3. User edits tone.
4. App validates:
   - title length,
   - tag count,
   - tag length,
   - required AI disclosure setting.
5. User copies to clipboard or downloads `.txt`/`.csv`.

# 20 Decisions and Tradeoffs

## Decision 1: Manual Etsy export before direct Etsy publishing

### Chosen

MVP creates downloadable Etsy-ready ZIP files and listing assets. Seller manually uploads to Etsy.

### Why

- Lower OAuth/API complexity.
- Fewer account approval and token security issues.
- Seller can review category, price, taxes, AI disclosure, and policies manually.
- Faster MVP validation.

### Tradeoff

- Less automation.
- Seller still copies data into Etsy.

### Future

Add Etsy draft listing creation after manual export flow is stable.

## Decision 2: One high-resolution master file per ratio

### Chosen

Export one master JPG per ratio instead of separate files for each print size.

Example:

```txt
2x3_24x36in_300dpi.jpg
```

This single file supports 4x6, 8x12, 12x18, 16x24, 20x30, and 24x36 prints.

### Why

- Reduces file count.
- Keeps Etsy's 5-file limit realistic.
- Avoids ZIPs becoming too large.
- Easier for buyers when explained in PDF.

### Tradeoff

- Beginner buyers may need explanation.

### Mitigation

Include buyer instruction PDF and `included-files` mockup image.

## Decision 3: JPG default, PNG optional

### Chosen

Use high-quality progressive JPG as default print output.

### Why

- Wall art is usually full-color raster art.
- JPG files are smaller and more likely to fit Etsy limits.
- Print providers commonly accept JPG.

### Tradeoff

- PNG can preserve flat graphics better.

### Mitigation

Offer PNG export later for line art/flat vector-like designs when file size allows.

## Decision 4: 300 DPI target, 150 DPI warning threshold

### Chosen

Default target is 300 DPI at max listed print size. Warn when effective DPI would fall below 150 for large posters.

### Why

- 300 DPI is widely recommended for sharp paper prints.
- Large posters can sometimes be acceptable at lower DPI due to viewing distance.
- The app should be honest about quality rather than relying on fake DPI metadata.

### Tradeoff

- 300 DPI files can be large.

### Mitigation

Use ratio masters, compression fallback, and max-size tiers.

## Decision 5: Do not focus on quote art in MVP

### Chosen

MVP emphasizes non-typographic wall art: landscapes, abstract, botanical, nursery visuals, patterns.

### Why

- AI image models can struggle with exact text rendering.
- Bad typography creates refunds/support issues.
- Quote art has more copyright/trademark risks.

### Tradeoff

- Quote-print sellers are a large niche.

### Future

Add quote art with real text layout rendered by the app, not generated inside the image. Use fonts with valid licenses and deterministic canvas/SVG/PDF layout.

## Decision 6: Provider abstraction from day one

### Chosen

Use `ImageProvider`, `UpscaleProvider`, and `StorageProvider` interfaces.

### Why

- AI providers change pricing, model names, limits, and quality.
- Upscale may need a different provider from generation.
- Avoid lock-in inside business logic.

### Tradeoff

- Slightly more upfront code.

### Mitigation

Only implement mock + Runware provider first.

## Decision 7: Credits instead of unlimited plans

### Chosen

Subscriptions grant monthly credits.

### Why

- Image generation and exports cost money.
- Credits prevent abuse.
- Users understand usage limits.

### Tradeoff

- More billing logic.

### Mitigation

Use simple ledger and clear UI.

## Decision 8: Basic deterministic mockups first

### Chosen

Generate mockups through deterministic composition/templates, not AI-generated rooms.

### Why

- Avoid misleading physical product representation.
- Avoid inconsistent room styles or artifacts.
- Easier to control Etsy listing image size.

### Tradeoff

- Mockups may look less unique at first.

### Future

Add premium mockup library and user-uploaded templates.

## Decision 9: Block protected IP and living artist mimicry

### Chosen

Prompts referencing brands, characters, celebrities, logos, and living artists are blocked or rewritten.

### Why

- Etsy sellers need commercially safer outputs.
- This lowers takedown/support risk.
- It supports a trustworthy app brand.

### Tradeoff

- Some users may be frustrated that trend-based prompts are blocked.

### Mitigation

Provide generic safe alternatives.

## Decision 10: Async jobs for all expensive work

### Chosen

Generation and export run through jobs/workers.

### Why

- Provider latency can be high.
- Exporting large print files can exceed serverless route time/memory.
- Jobs enable retries, progress states, and credit refunds.

### Tradeoff

- More infrastructure.

### Mitigation

Use local synchronous job runner in development and a hosted job runner in production.

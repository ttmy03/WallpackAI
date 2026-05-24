# 10 UI/UX Spec

## Design direction

- Clean, premium, calm.
- Seller-focused, not flashy AI gimmick.
- Use lots of preview cards, print-size clarity, and step-by-step progress.
- Avoid overwhelming users with print jargon.

## Main routes

```txt
/                          Landing page
/pricing                   Pricing
/auth/sign-in              Sign in
/auth/sign-up              Sign up
/app                       Dashboard
/app/new                   New wall-art pack wizard
/app/projects              Project list
/app/projects/[id]         Project overview
/app/projects/[id]/editor  Artwork editor and ratio crops
/app/projects/[id]/exports Export history
/app/exports/[id]          Export details/download
/app/settings              Account settings
/app/settings/billing      Billing and credits
/app/help/print-sizes      Print-size help
```

## Landing page sections

1. Hero
   - `Create Etsy-ready printable wall art packs in minutes.`
   - CTA: `Start creating`.
2. Workflow
   - Prompt -> Preview -> Ratio Pack -> Mockups -> Etsy Listing.
3. Why not a normal AI image generator
   - Exact print ratios.
   - Etsy-compatible files.
   - Listing copy and tags.
4. Example pack contents.
5. Pricing.
6. FAQ.

## Dashboard

### Components

- Credit balance card.
- `New Wall Art Pack` button.
- Recent projects grid.
- Recent exports list.
- Failed jobs needing action.

### Empty state

```txt
Create your first Etsy-ready printable wall art pack.
Start with a style preset, generate previews, and export print files in common frame ratios.
```

## New pack wizard

### Step 1: Concept

Fields:

- Pack name.
- Subject/theme.
- Etsy niche.
- Room/use case.

Examples under input:

- `minimalist mountain landscape`
- `boho botanical wildflower set`
- `neutral abstract shapes`
- `soft nursery moon and stars`

### Step 2: Style

Grid of style preset cards:

- visual placeholder,
- title,
- description,
- best for.

### Step 3: Palette

Palette cards with color chips.
Allow custom palette text.

### Step 4: Composition

Options:

- Centered subject.
- Landscape scene.
- Abstract full bleed.
- Minimal negative space.
- Pattern/symmetrical.

Warn:

```txt
For multi-ratio Etsy packs, keep important details away from edges.
```

### Step 5: Generate

Show summary:

- prompt concept,
- style,
- palette,
- preview count,
- credit cost.

Button:

```txt
Generate 2 previews - uses 2 credits
```

## Generation progress

States:

- Validating prompt.
- Reserving credits.
- Creating previews.
- Checking image quality.
- Done.

Use progress stepper, not fake percentage.

## Project editor

### Layout

Left:

- artwork preview gallery.

Center:

- selected artwork large preview.
- focal point control.

Right:

- ratio preview tabs.
- export settings.
- quality warnings.
- `Create Etsy Pack` button.

### Ratio preview card

Shows:

- ratio label,
- target max print size,
- target pixels,
- crop warning,
- file size estimate when available.

Example:

```txt
2:3 Poster
24 x 36 in @ 300 DPI
7200 x 10800 px
```

## Crop editor

MVP:

- draggable focal point.
- ratio preview updates.
- reset to center.
- save crop settings.

Future:

- manual crop handles.
- saliency detection.
- AI outpaint.

## Export modal

Before export show:

- selected ratios,
- credit cost,
- expected files,
- target DPI,
- Etsy compatibility warning.

Copy:

```txt
We will create up to 5 Etsy-compatible ZIP files. Each file targets under 18 MB so it can fit Etsy's 20 MB upload limit.
```

## Export completed page

Sections:

1. Download Etsy upload files.
2. Download seller asset pack.
3. Listing copy with copy buttons.
4. Etsy tags with copy button.
5. Mockups gallery.
6. Quality report.
7. Re-export actions.

## Error states

### Prompt blocked

```txt
This prompt mentions a protected brand, character, artist, or logo. Try describing the visual direction generically.
```

CTA:

- `Use safer suggestion`.
- `Edit prompt`.

### Provider failed

```txt
Image generation failed. Your credits were refunded.
```

CTA:

- `Try again`.

### Export too large

```txt
Some files are too large for Etsy's upload limit. Reduce max print size or exclude extras from Etsy upload files.
```

CTA:

- `Optimize for Etsy`.
- `Export smaller size`.

### Insufficient credits

```txt
You need 5 credits to create this pack. You have 2 credits.
```

CTA:

- `Upgrade plan`.
- `Buy credits`.

## Accessibility

- All form fields labeled.
- Keyboard navigable preset cards.
- Sufficient contrast.
- Progress states announced by text.
- Images have meaningful alt text.
- Do not rely on color alone for warnings.

## Microcopy glossary

Use:

- `Print file` instead of `asset`.
- `Ratio` instead of `aspect-ratio` in UI.
- `300 DPI` with tooltip: `Print quality setting. Pixel size matters most.`
- `Etsy upload file` instead of `artifact`.
- `Buyer instructions` instead of `documentation`.

## Important UX decisions

### Do not make users select every print size

Let users select ratio pack. Explain that one high-resolution ratio file can print multiple frame sizes.

### Do not show provider model names in main UI

Show quality tiers. Keep model/provider in advanced details.

### Do not force direct Etsy integration

Manual export first is simpler and safer.

### Include educational tooltips

Examples:

- `A 2:3 file works for 8x12, 12x18, 16x24, 20x30, and 24x36 frames.`
- `DPI metadata alone is not enough; we create the actual pixel dimensions needed for print.`

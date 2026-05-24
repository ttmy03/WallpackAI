# 09 Prompt System and Presets

## Prompt strategy

The app should not expose users to raw prompt engineering first. It should convert structured seller intent into consistent, safe prompts.

## Prompt builder inputs

- Subject.
- Niche.
- Room.
- Style preset.
- Palette preset.
- Mood.
- Composition.
- Exclusions.
- Primary ratio.

## Global prompt rules

Always add:

```txt
No text, no words, no letters, no logo, no watermark, no signature, no frame, no room mockup.
```

Always prefer:

```txt
original design, printable wall art, clean composition, central safe area, high detail, tasteful negative space.
```

## Style presets

### `japandi_minimal`

```json
{
  "label": "Japandi Minimal",
  "description": "minimal Japanese-Scandinavian inspired decor aesthetic, warm neutrals, soft organic shapes, calm negative space, refined simplicity",
  "bestFor": ["living room", "bedroom", "office"],
  "avoid": ["busy detail", "high saturation", "text"]
}
```

### `boho_botanical`

```json
{
  "label": "Boho Botanical",
  "description": "earthy bohemian botanical wall art, dried flowers, organic leaves, natural shapes, warm beige and terracotta accents",
  "bestFor": ["bedroom", "nursery", "living room"],
  "avoid": ["photorealistic clutter", "logos", "text"]
}
```

### `abstract_neutral`

```json
{
  "label": "Abstract Neutral",
  "description": "modern abstract wall art with layered organic forms, neutral tones, subtle texture, balanced composition",
  "bestFor": ["living room", "office", "gallery wall"],
  "avoid": ["recognizable brand symbols", "letter-like shapes"]
}
```

### `nursery_soft`

```json
{
  "label": "Soft Nursery",
  "description": "gentle nursery wall art, soft shapes, soothing pastel palette, child-friendly atmosphere, calm and warm",
  "bestFor": ["nursery", "kids room"],
  "avoid": ["scary imagery", "sharp contrast", "text"]
}
```

### `vintage_landscape`

```json
{
  "label": "Vintage Landscape",
  "description": "timeless vintage-inspired landscape print, painterly texture, muted colors, nostalgic atmosphere, original composition",
  "bestFor": ["living room", "study", "hallway"],
  "avoid": ["specific artist imitation", "museum reproduction"]
}
```

### `islamic_geometry`

```json
{
  "label": "Islamic Geometry",
  "description": "original geometric ornament inspired by traditional Islamic pattern principles, symmetrical, elegant, refined, no calligraphy or text",
  "bestFor": ["prayer room", "living room", "hallway"],
  "avoid": ["sacred text", "calligraphy", "brand marks"]
}
```

### `coastal_calm`

```json
{
  "label": "Coastal Calm",
  "description": "calm coastal wall art, soft ocean-inspired palette, airy composition, relaxed beach house decor aesthetic",
  "bestFor": ["bathroom", "bedroom", "living room"],
  "avoid": ["tourism logos", "text", "busy people"]
}
```

### `dark_academia`

```json
{
  "label": "Dark Academia",
  "description": "moody scholarly vintage-inspired wall art, deep browns, antique paper tones, classic still life elements, original composition",
  "bestFor": ["study", "library", "office"],
  "avoid": ["readable book text", "specific copyrighted covers"]
}
```

## Palette presets

```json
[
  {
    "key": "warm_neutral_sage",
    "label": "Warm Neutral + Sage",
    "colors": ["warm beige", "ivory", "muted sage", "soft charcoal"]
  },
  {
    "key": "terracotta_boho",
    "label": "Terracotta Boho",
    "colors": ["terracotta", "sand", "cream", "burnt orange", "clay brown"]
  },
  {
    "key": "black_white_minimal",
    "label": "Black & White Minimal",
    "colors": ["black", "white", "warm gray"]
  },
  {
    "key": "pastel_nursery",
    "label": "Pastel Nursery",
    "colors": ["soft peach", "powder blue", "cream", "pale sage"]
  },
  {
    "key": "coastal_blue",
    "label": "Coastal Blue",
    "colors": ["seafoam", "sand", "cream", "muted blue", "driftwood gray"]
  }
]
```

## Prompt examples

### Example 1

Input:

```json
{
  "subject": "mountain landscape",
  "stylePresetKey": "japandi_minimal",
  "paletteKey": "warm_neutral_sage",
  "room": "living room",
  "mood": "calm",
  "composition": "centered with large negative space"
}
```

Final prompt:

```txt
Create a high-quality printable wall art image for an Etsy digital download product.

Subject/theme: an original minimalist mountain landscape
Room/use case: Japandi living room decor
Style direction: minimal Japanese-Scandinavian inspired decor aesthetic, warm neutrals, soft organic shapes, calm negative space, refined simplicity
Color palette: warm beige, ivory, muted sage, soft charcoal
Mood: calm and serene
Composition: centered with large negative space. Keep the main subject inside the central 80% safe area so the artwork can be cropped into multiple print ratios.

Output requirements:
clean printable wall art composition, no text, no words, no letters, no logo, no signature, no watermark, no frame, no room mockup, artwork only, crisp details, tasteful texture, balanced contrast.
```

## Blocklist categories

The implementation should use a configurable blocklist and a classifier-style guard.

### Block by default

- Disney, Pixar, Marvel, DC, Star Wars, Pokémon, Nintendo, Harry Potter, Barbie, Nike, Adidas, Apple, Gucci, etc.
- Celebrity names and public figures for portraits.
- Living artist names and "in the style of [living artist]".
- Studio names used as style imitation.
- Logos and brand marks.
- Prompt bundles as a product type.

### Allow generic alternatives

- `fairytale-inspired` instead of protected princess franchises.
- `whimsical hand-painted animation-inspired` instead of a specific studio.
- `street-art inspired stencil aesthetic` instead of a named artist.
- `luxury fashion-inspired abstract pattern` instead of a brand logo.

## Listing copy prompt

```txt
You are creating Etsy listing copy for a printable digital wall art product.

Constraints:
- Title max 140 characters.
- Up to 13 tags.
- Each tag max 20 characters.
- Mention this is a digital download; no physical item will be shipped.
- Include file ratios and print sizes from the provided manifest.
- Include AI disclosure if includeAiDisclosure is true.
- Do not promise search ranking, sales, or guaranteed colors.
- Avoid trademark names and celebrity references.

Return JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["..."]
}
```

## Prompt testing

Create unit tests for:

- prompt includes all required exclusions,
- living artist style gets blocked,
- franchise prompt gets blocked,
- safe generic style passes,
- tags validate length,
- AI disclosure appears in listing description.

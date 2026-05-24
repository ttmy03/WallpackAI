# 06 Image Generation Pipeline

## Goal

Generate commercially usable wall-art source images that can be converted into multiple print ratios with minimal cropping damage.

## Pipeline overview

```txt
User inputs
  -> prompt validation
  -> prompt enrichment
  -> provider image generation
  -> source image storage
  -> preview thumbnail generation
  -> quality checks
  -> project gallery
```

## Prompt input structure

```ts
type WallArtPromptInput = {
  subject: string;
  room?: string;
  audience?: string;
  stylePresetKey: string;
  paletteKey?: string;
  customPalette?: string[];
  mood?: string;
  composition?: string;
  primaryRatio: '2x3' | '3x4' | '4x5' | '5x7' | '11x14' | '1x1';
  avoid: string[];
};
```

## Prompt enrichment goals

The final provider prompt should:

- Clearly describe wall-art output.
- Ask for no text, no logo, no signature, no watermark.
- Ask for a clean centered composition with safe margins.
- Avoid protected IP and artist/style mimicry.
- Specify color palette and mood.
- Avoid photorealistic people unless explicitly allowed.
- Avoid small detailed text-like artifacts.

## Prompt template

```txt
Create a high-quality printable wall art image for an Etsy digital download product.

Subject/theme: {{subject}}
Room/use case: {{room}}
Audience: {{audience}}
Style direction: {{stylePreset.description}}
Color palette: {{palette.colors}}
Mood: {{mood}}
Composition: {{composition}}. Keep the main subject inside the central 80% safe area so the artwork can be cropped into multiple print ratios.

Output requirements:
- clean wall art composition
- no text, no letters, no logo, no signature, no watermark
- no frame, no mat border, no room mockup, artwork only
- avoid distorted hands, faces, bodies, typography, symbols, or brand marks
- suitable for printable poster art
- crisp details, balanced contrast, tasteful negative space
```

## Negative prompt / exclusions

Provider support varies. Always include exclusions in the main prompt even if a negative prompt is also available.

Default exclusions:

```txt
text, words, letters, logo, watermark, signature, frame, poster mockup, room mockup, brand names, celebrity likeness, copyrighted characters, distorted anatomy, blurry details, low-resolution artifacts
```

## Ratio-aware generation

### Recommended generation sizes

Use provider-supported portrait/landscape sizes closest to the user's primary ratio.

For Runware image models, keep AIR model selection and dimensions in the provider adapter. GPT Image 2 uses the AIR ID `openai:gpt-image@2` and requires explicit dimensions for text-to-image requests. After generation, upscale with `prunaai:p-image@upscale` and send the product negative prompt plus extra cleanup terms for borders, wall scenes, frames, mockups, text, logos, and watermarks.

MVP recommendation:

```ts
const PROVIDER_SIZE_BY_RATIO = {
  '2x3': '1664x2496',
  '3x4': '1728x2304',
  '4x5': '2048x2560',
  '5x7': '2048x2864',
  '11x14': '2048x2608',
  '1x1': '2048x2048'
};
```

If provider supports custom sizes up to larger edges, prefer higher source resolution:

```ts
const HIGH_SOURCE_SIZE_BY_RATIO = {
  '2x3': '2160x3248',
  '3x4': '2160x2880',
  '4x5': '2160x2704',
  '5x7': '2160x3024',
  '11x14': '2048x2608'
};
```

Do not assume a provider supports arbitrary sizes. Validate size against provider capabilities at runtime or in config.

## Quality levels

MVP quality options:

- `draft`: cheapest previews; low or medium quality.
- `standard`: default for paid previews.
- `premium`: final source generation where supported.

Do not expose provider-specific names directly in UI. Map UI quality to provider settings.

## Guardrails

Block or ask user to revise prompts containing:

- famous brand names,
- copyrighted characters/franchises,
- celebrity names,
- requests for logos,
- living artist style names,
- exact imitation of protected studio styles,
- nudity/sexual content as default app niche,
- violence/hate/illegal content,
- medical/legal/financial claims in art.

Example rewrite suggestions:

| Blocked input | Safer alternative |
|---|---|
| `Disney princess` | `fairytale princess-inspired character, original design` |
| `Ghibli style` | `soft whimsical hand-painted animation-inspired landscape` |
| `Nike logo poster` | `minimal sports-inspired abstract poster with no logos` |
| `Banksy style` | `satirical stencil-inspired street art aesthetic` |

## Source image storage

Store original provider image as PNG or high-quality JPG depending on provider output.

Suggested paths:

```txt
sources/{userId}/{projectId}/{artworkId}/source.png
previews/{userId}/{projectId}/{artworkId}/preview_1024.jpg
```

Record:

- model,
- provider,
- final prompt,
- image dimensions,
- createdAt,
- provider request id,
- cost/usage metadata if available.

## Generation quality checks

MVP checks:

- image exists and decodes,
- width/height recorded,
- aspect ratio roughly expected,
- no transparent background for wall art unless user explicitly requested graphic PNG,
- detect extreme blur using Laplacian variance or similar simple heuristic,
- detect mostly blank image,
- warn if source is too small for 24x36 without high upscale factor,
- optionally use vision model/classifier later for text/logo artifacts.

## Provider abstraction example

```ts
export type GenerateImageInput = {
  prompt: string;
  count: number;
  ratioKey: string;
  quality: 'draft' | 'standard' | 'premium';
  userId: string;
  projectId: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number;
  height: number;
  providerRequestId?: string;
  usage?: Record<string, unknown>;
};
```

## Retry policy

Retry automatically only for transient errors:

- provider 429 with backoff,
- network timeout,
- storage upload failure,
- job worker crash.

Do not retry automatically for:

- prompt blocked,
- provider content rejection,
- insufficient credits,
- invalid user input.

## Credits

Generation credit reserve happens before provider call. On provider failure, refund reservation. On success, commit reservation.

## Avoid support traps

- Do not promise exact repeatability unless provider offers seeds and the implementation stores them.
- Do not promise perfect text rendering inside images.
- Avoid quote art in MVP.
- Do not generate art based on uploaded copyrighted images unless user confirms rights in future upload flow.

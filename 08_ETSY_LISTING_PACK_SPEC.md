# 08 Etsy Listing Pack Spec

## Purpose

The app should create everything a seller needs to manually publish a digital wall-art listing on Etsy.

## Pack outputs

### Buyer-facing files

- High-resolution printable JPG files.
- Buyer instruction PDF.

### Seller-facing files

- Mockup images.
- Etsy title.
- Etsy description.
- Etsy tags.
- File manifest.
- Optional thumbnail.

## Etsy digital listing constraints to encode

- Digital downloads can be instant downloads or made-to-order downloads.
- Instant downloads support up to 5 digital files.
- Each digital file can be up to 20 MB.
- ZIP, JPG, PNG, PDF and other listed types are supported.
- Digital variations are unavailable.
- Etsy listing titles can be up to 140 characters.
- Etsy tags: up to 13 tags, each up to 20 characters.
- Listing images should be at least 2000 px wide/high when possible.

## Listing title generation

### Constraints

- <= 140 characters.
- Clear product type.
- Primary keyword early.
- No keyword stuffing.
- No unsupported claims.
- Avoid trademark names.

### Example

```txt
Japandi Mountain Wall Art, Neutral Printable Poster, Minimalist Landscape Print, Beige Digital Download
```

## Tags generation

Return up to 13 tags, each <= 20 characters.

Example:

```txt
japandi wall art
neutral print
mountain poster
printable art
beige wall decor
minimalist print
landscape print
digital download
living room art
boho wall art
modern poster
instant download
sage green art
```

Validator should trim or reject tags over 20 characters.

## Description template

```txt
Printable wall art digital download for {{style/theme}} decor.

WHAT YOU WILL RECEIVE
This is a digital download. No physical product will be shipped.

Your purchase includes high-resolution JPG files in multiple ratios so you can print common frame sizes:

2:3 ratio: 4x6, 8x12, 12x18, 16x24, 20x30, 24x36 in
3:4 ratio: 6x8, 9x12, 12x16, 15x20, 18x24 in
4:5 ratio: 4x5, 8x10, 12x15, 16x20 in
5:7 ratio: 5x7, 10x14, 15x21, 20x28 in
11:14 ratio: 11x14, 22x28 in

HOW TO DOWNLOAD
After purchase, your files will be available in your Etsy account under Purchases and Reviews.

PRINTING TIPS
You can print at home, at a local print shop, or through an online printing service. Colors may vary slightly depending on your monitor, printer, ink, and paper.

AI DISCLOSURE
This artwork was created with the assistance of AI tools and was curated, edited, and prepared as a finished digital design by the seller.

TERMS OF USE
For personal use only unless the seller states otherwise. Do not resell, redistribute, or share the digital files.
```

## AI disclosure rules

The app should include an AI disclosure by default.

User may edit the wording, but UI should explain that Etsy expects sellers to disclose AI-created items in listing descriptions.

Default disclosure:

```txt
This artwork was created with the assistance of AI tools and was curated, edited, and prepared as a finished digital design by the seller.
```

Short disclosure:

```txt
Created with AI assistance and finalized by the seller.
```

## Mockup generation

MVP should generate simple seller mockups from templates, not AI-generated room scenes.

Reason: AI room mockups may introduce mismatched frames, impossible shadows, text artifacts, or misleading physical-product cues.

### Mockup types

1. `mockup-square.jpg`
   - 2000 x 2000 px.
   - Shows artwork in frame on neutral wall.
   - Use real template or deterministic composition.

2. `mockup-ratio-grid.jpg`
   - 2000 x 2000 px.
   - Shows 5 ratio thumbnails with labels.

3. `included-files.jpg`
   - 2000 x 2000 px.
   - Visual checklist of file ratios and print sizes.

4. Optional `lifestyle-horizontal.jpg`
   - 2500 x 2000 px or 2000 x 1600 px.

### Mockup image constraints

- Etsy listing images should be JPG/PNG where supported.
- Avoid transparency for Etsy listing images.
- Export mockups around 2000 px or larger.
- Keep file size reasonable for upload.
- Do not show a physical frame in a way that implies frame is included; include overlay text such as `Digital download - frame not included` only on seller mockups, not print files.

## Listing asset files

### `listing-copy.txt`

Include:

```txt
TITLE
...

DESCRIPTION
...

TAGS
1. ...
2. ...
```

### `etsy-tags.csv`

```csv
tag
japandi wall art
neutral print
...
```

### `listing-fields.json`

```json
{
  "title": "...",
  "description": "...",
  "tags": ["..."],
  "materials": ["digital download", "jpg file", "printable art"],
  "whoMade": "i_did",
  "type": "download",
  "aiDisclosureIncluded": true
}
```

## Future Etsy API publishing

Post-MVP can create Etsy draft listings with Open API v3.

Draft publishing flow:

1. OAuth connect Etsy shop.
2. Create draft listing.
3. Upload listing images.
4. Upload digital file(s).
5. Set type to `download`.
6. Let seller review in Etsy before publishing.

Default should create drafts, not publish live, because seller must verify policy/category/price/tax details.

## Seller warnings

Show before download:

- `You are responsible for ensuring your listing follows Etsy policies.`
- `AI disclosure text is provided as a helper; edit it to match your actual workflow.`
- `Do not list designs that copy brands, celebrities, living artists, or copyrighted characters.`
- `No physical product disclaimer should remain in the listing description.`

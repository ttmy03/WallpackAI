# 07 Print Export Spec

## Core rule

Print quality is determined primarily by actual pixel dimensions at the intended physical size. DPI metadata alone does not make a file print-ready.

Formula:

```txt
pixels = inches * DPI
```

Example:

```txt
24 x 36 in at 300 DPI = 7200 x 10800 px
```

## Default target

- Default target DPI: 300.
- Minimum acceptable large-poster DPI warning threshold: 150.
- Color profile: sRGB for JPG exports.
- Default file type: JPG.
- Optional file type: PNG only for graphic/flat art when file size remains Etsy-compatible.

## Ratio presets

### `2:3` ratio

Use one master file:

```txt
2x3_24x36in_300dpi.jpg
7200 x 10800 px
```

Buyer can print:

- 4 x 6 in
- 8 x 12 in
- 12 x 18 in
- 16 x 24 in
- 20 x 30 in
- 24 x 36 in

### `3:4` ratio

```txt
3x4_18x24in_300dpi.jpg
5400 x 7200 px
```

Buyer can print:

- 6 x 8 in
- 9 x 12 in
- 12 x 16 in
- 15 x 20 in
- 18 x 24 in

### `4:5` ratio

```txt
4x5_16x20in_300dpi.jpg
4800 x 6000 px
```

Buyer can print:

- 4 x 5 in
- 8 x 10 in
- 12 x 15 in
- 16 x 20 in

### `5:7` ratio

```txt
5x7_20x28in_300dpi.jpg
6000 x 8400 px
```

Buyer can print:

- 5 x 7 in
- 10 x 14 in
- 15 x 21 in
- 20 x 28 in

### `11:14` ratio

```txt
11x14_22x28in_300dpi.jpg
6600 x 8400 px
```

Buyer can print:

- 11 x 14 in
- 22 x 28 in

### ISO A-series optional

A-series ratio is sqrt(2), approximately 1:1.4142.

Use:

```txt
A-series_A2_300dpi.jpg
4961 x 7016 px
```

Buyer can print:

- A5
- A4
- A3
- A2

## Print preset object

```ts
export type PrintRatioPreset = {
  key: '2x3' | '3x4' | '4x5' | '5x7' | '11x14' | 'iso-a';
  label: string;
  ratioWidth: number;
  ratioHeight: number;
  masterPrintWidthIn: number;
  masterPrintHeightIn: number;
  targetDpi: number;
  fileName: string;
  supportedPrintSizes: string[];
};
```

## Canonical presets

```ts
export const PRINT_RATIO_PRESETS = {
  '2x3': {
    key: '2x3', label: '2:3', ratioWidth: 2, ratioHeight: 3,
    masterPrintWidthIn: 24, masterPrintHeightIn: 36, targetDpi: 300,
    fileName: '2x3_24x36in_300dpi.jpg',
    supportedPrintSizes: ['4x6', '8x12', '12x18', '16x24', '20x30', '24x36']
  },
  '3x4': {
    key: '3x4', label: '3:4', ratioWidth: 3, ratioHeight: 4,
    masterPrintWidthIn: 18, masterPrintHeightIn: 24, targetDpi: 300,
    fileName: '3x4_18x24in_300dpi.jpg',
    supportedPrintSizes: ['6x8', '9x12', '12x16', '15x20', '18x24']
  },
  '4x5': {
    key: '4x5', label: '4:5', ratioWidth: 4, ratioHeight: 5,
    masterPrintWidthIn: 16, masterPrintHeightIn: 20, targetDpi: 300,
    fileName: '4x5_16x20in_300dpi.jpg',
    supportedPrintSizes: ['4x5', '8x10', '12x15', '16x20']
  },
  '5x7': {
    key: '5x7', label: '5:7', ratioWidth: 5, ratioHeight: 7,
    masterPrintWidthIn: 20, masterPrintHeightIn: 28, targetDpi: 300,
    fileName: '5x7_20x28in_300dpi.jpg',
    supportedPrintSizes: ['5x7', '10x14', '15x21', '20x28']
  },
  '11x14': {
    key: '11x14', label: '11:14', ratioWidth: 11, ratioHeight: 14,
    masterPrintWidthIn: 22, masterPrintHeightIn: 28, targetDpi: 300,
    fileName: '11x14_22x28in_300dpi.jpg',
    supportedPrintSizes: ['11x14', '22x28']
  },
  'iso-a': {
    key: 'iso-a', label: 'A-Series', ratioWidth: 1, ratioHeight: 1.41421356237,
    masterPrintWidthIn: 16.54, masterPrintHeightIn: 23.39, targetDpi: 300,
    fileName: 'A-series_A2_300dpi.jpg',
    supportedPrintSizes: ['A5', 'A4', 'A3', 'A2']
  }
} as const;
```

## Pixel calculation utility

```ts
export function inchesToPixels(inches: number, dpi: number): number {
  return Math.round(inches * dpi);
}

export function presetToPixels(preset: PrintRatioPreset): { width: number; height: number } {
  return {
    width: inchesToPixels(preset.masterPrintWidthIn, preset.targetDpi),
    height: inchesToPixels(preset.masterPrintHeightIn, preset.targetDpi)
  };
}
```

## Ratio conversion

### Input

- One source artwork.
- Focal point x/y.
- Optional saved crop rectangle per ratio.

### MVP behavior

1. Compute target aspect ratio.
2. Crop source image using focal point to match target ratio.
3. Resize cropped image to target pixels using high-quality resize.
4. Export as progressive JPG with target DPI metadata.
5. If file exceeds target bytes, reduce JPG quality stepwise.
6. If quality falls below minimum and file is still too large, create warning and split outputs.

### Future behavior

- AI outpaint/canvas extension for ratios that would cut important content.
- Saliency/face detection for better automatic crop.
- Advanced upscaler provider.

## Upscale strategy

MVP has two levels:

### Level 1: deterministic resize

Use Sharp/Lanczos for resizing. This is reliable and cheap, but not true detail reconstruction.

Use warning if upscale factor exceeds 3x.

```ts
upscaleFactor = targetLongEdge / sourceCroppedLongEdge
```

Warnings:

- <= 2x: pass.
- > 2x and <= 3x: warning.
- > 3x: strong warning or require advanced upscale.

### Level 2: advanced upscale adapter

Implement interface but make optional:

```ts
interface UpscaleProvider {
  upscale(input: {
    image: Buffer;
    targetWidth: number;
    targetHeight: number;
    mode: 'art' | 'photo' | 'line_art';
  }): Promise<Buffer>;
}
```

Do not hard-code one vendor in product logic.

## JPG export settings

Default:

```ts
{
  qualityStart: 92,
  qualityMin: 82,
  progressive: true,
  chromaSubsampling: '4:4:4',
  mozjpeg: true,
  density: 300
}
```

Fallback loop:

```txt
quality 92 -> 90 -> 88 -> 86 -> 84 -> 82
```

If still too large:

- split ZIPs,
- remove mockups from Etsy upload ZIP,
- offer smaller max print size.

## Etsy ZIP strategy

Default target: 18 MB per ZIP.
Hard block: 20 MB per Etsy upload file.
Max files: 5.

### Preferred structure

Create up to 5 Etsy upload files:

```txt
WallPackAI_YourArtwork_PrintFiles_1.zip
  2x3_24x36in_300dpi.jpg
  README_BUYER_INSTRUCTIONS.pdf

WallPackAI_YourArtwork_PrintFiles_2.zip
  3x4_18x24in_300dpi.jpg

WallPackAI_YourArtwork_PrintFiles_3.zip
  4x5_16x20in_300dpi.jpg

WallPackAI_YourArtwork_PrintFiles_4.zip
  5x7_20x28in_300dpi.jpg

WallPackAI_YourArtwork_PrintFiles_5.zip
  11x14_22x28in_300dpi.jpg
  listing-copy.txt
  etsy-tags.csv
```

Mockups are for the seller's listing images, not necessarily buyer download files. Put them in a separate seller-only download if needed.

## Buyer PDF content

The buyer PDF should include:

- Thank you note.
- No physical product disclaimer.
- Files included.
- Which file to use for each print size.
- Print recommendations.
- Color disclaimer.
- Personal-use/license placeholder.
- Contact seller instruction placeholder.

## Manifest JSON

Every export includes internal support manifest:

```json
{
  "exportId": "exp_123",
  "createdAt": "2026-05-24T00:00:00Z",
  "targetDpi": 300,
  "ratios": [
    {
      "key": "2x3",
      "file": "2x3_24x36in_300dpi.jpg",
      "width": 7200,
      "height": 10800,
      "bytes": 14500322,
      "effectiveDpiAtMaxSize": 300
    }
  ],
  "warnings": []
}
```

## Unit tests required

- `2x3` produces 7200 x 10800.
- `3x4` produces 5400 x 7200.
- `4x5` produces 4800 x 6000.
- `5x7` produces 6000 x 8400.
- `11x14` produces 6600 x 8400.
- `iso-a` A2 produces approximately 4961 x 7016.
- ZIP splitter never emits more than 5 default Etsy upload files.
- JPG fallback never returns quality below configured minimum without warning.
- File names contain only safe characters.

import { deflateSync } from "node:zlib";

import type {
  GeneratedImage,
  GenerateImageInput,
  ImageProvider
} from "@/lib/ai/image-provider";

export class MockImageProvider implements ImageProvider {
  async generate(input: GenerateImageInput): Promise<GeneratedImage[]> {
    const dimensions = resolveMockDimensions(input);

    return Array.from({ length: input.count }, (_, index) => ({
      bytes: createMockWallArtPng({
        ...dimensions,
        seed: hashString(`${input.prompt}:${input.aspectRatio ?? ""}:${index}`)
      }),
      mimeType: "image/png" as const,
      width: dimensions.width,
      height: dimensions.height,
      providerRequestId: input.referenceImages?.length
        ? `mock-reference-image-${index + 1}`
        : `mock-image-${index + 1}`,
      usage: {
        model: "mock",
        referenceImageCount: input.referenceImages?.length ?? 0,
        cost: 0
      }
    }));
  }
}

function resolveMockDimensions(input: GenerateImageInput) {
  if (input.width && input.height) {
    return {
      width: clampDimension(input.width),
      height: clampDimension(input.height)
    };
  }

  switch (input.aspectRatio?.toLowerCase().replace(":", "x").trim()) {
    case "1x1":
      return { width: 960, height: 960 };
    case "3x4":
      return { width: 900, height: 1200 };
    case "4x5":
      return { width: 960, height: 1200 };
    case "5x7":
      return { width: 900, height: 1260 };
    case "11x14":
      return { width: 990, height: 1260 };
    case "iso-a":
      return { width: 840, height: 1188 };
    case "3x2":
      return { width: 1296, height: 864 };
    case "4x3":
      return { width: 1200, height: 900 };
    case "5x4":
      return { width: 1200, height: 960 };
    case "7x5":
      return { width: 1260, height: 900 };
    case "14x11":
      return { width: 1260, height: 990 };
    case "iso-a-landscape":
      return { width: 1188, height: 840 };
    case "2x3":
    default:
      return { width: 864, height: 1296 };
  }
}

function createMockWallArtPng(input: {
  width: number;
  height: number;
  seed: number;
}) {
  const { width, height, seed } = input;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const palette = getPalette(seed);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const nx = width === 1 ? 0 : x / (width - 1);
      const ny = height === 1 ? 0 : y / (height - 1);
      const wave =
        Math.sin((nx * 5.5 + seed * 0.0002) * Math.PI) * 0.14 +
        Math.cos((ny * 4.3 + seed * 0.0001) * Math.PI) * 0.11;
      const vignette = Math.max(0, 1 - Math.hypot(nx - 0.5, ny - 0.48) * 1.65);
      const mountain =
        ny > 0.5 + Math.sin(nx * Math.PI * 2.2 + seed) * 0.05 ? 0.22 : 0;
      const accent =
        Math.abs(nx - 0.5) + Math.abs(ny - 0.38) < 0.2 + (seed % 9) * 0.006
          ? 0.18
          : 0;
      const mix = clamp01(ny * 0.72 + vignette * 0.22 + wave + mountain);
      const color = mixColors(
        mixColors(palette.background, palette.mid, mix),
        palette.accent,
        accent
      );
      const offset = rowStart + 1 + x * 4;

      raw[offset] = color.r;
      raw[offset + 1] = color.g;
      raw[offset + 2] = color.b;
      raw[offset + 3] = 255;
    }
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  const chunkType = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([chunkType, data])), 0);

  return Buffer.concat([length, chunkType, data, crc]);
}

const crcTable = new Uint32Array(256);

for (let index = 0; index < crcTable.length; index += 1) {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  crcTable[index] = crc >>> 0;
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getPalette(seed: number) {
  const palettes = [
    {
      background: { r: 239, g: 232, b: 216 },
      mid: { r: 169, g: 187, b: 164 },
      accent: { r: 83, g: 111, b: 92 }
    },
    {
      background: { r: 235, g: 229, b: 220 },
      mid: { r: 188, g: 161, b: 133 },
      accent: { r: 63, g: 83, b: 103 }
    },
    {
      background: { r: 234, g: 235, b: 229 },
      mid: { r: 178, g: 191, b: 196 },
      accent: { r: 112, g: 99, b: 129 }
    }
  ];

  return palettes[Math.abs(seed) % palettes.length];
}

function mixColors(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  amount: number
) {
  const mix = clamp01(amount);

  return {
    r: Math.round(a.r + (b.r - a.r) * mix),
    g: Math.round(a.g + (b.g - a.g) * mix),
    b: Math.round(a.b + (b.b - a.b) * mix)
  };
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampDimension(value: number) {
  if (!Number.isFinite(value)) {
    return 512;
  }

  return Math.max(64, Math.min(2048, Math.trunc(value)));
}

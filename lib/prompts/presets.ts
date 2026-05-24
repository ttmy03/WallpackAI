export type StylePresetKey =
  | "japandi_minimal"
  | "boho_botanical"
  | "abstract_neutral"
  | "nursery_soft"
  | "vintage_landscape"
  | "islamic_geometry"
  | "coastal_calm"
  | "dark_academia";

export type PalettePresetKey =
  | "warm_neutral_sage"
  | "terracotta_boho"
  | "black_white_minimal"
  | "pastel_nursery"
  | "coastal_blue";

export type StylePreset = {
  key: StylePresetKey;
  label: string;
  description: string;
  bestFor: string[];
  avoid: string[];
};

export type PalettePreset = {
  key: PalettePresetKey;
  label: string;
  colors: string[];
};

export const STYLE_PRESETS: Record<StylePresetKey, StylePreset> = {
  japandi_minimal: {
    key: "japandi_minimal",
    label: "Japandi Minimal",
    description:
      "minimal Japanese-Scandinavian inspired decor aesthetic, warm neutrals, soft organic shapes, calm negative space, refined simplicity",
    bestFor: ["living room", "bedroom", "office"],
    avoid: ["busy detail", "high saturation", "text"]
  },
  boho_botanical: {
    key: "boho_botanical",
    label: "Boho Botanical",
    description:
      "earthy bohemian botanical wall art, dried flowers, organic leaves, natural shapes, warm beige and terracotta accents",
    bestFor: ["bedroom", "nursery", "living room"],
    avoid: ["photorealistic clutter", "logos", "text"]
  },
  abstract_neutral: {
    key: "abstract_neutral",
    label: "Abstract Neutral",
    description:
      "modern abstract wall art with layered organic forms, neutral tones, subtle texture, balanced composition",
    bestFor: ["living room", "office", "gallery wall"],
    avoid: ["recognizable brand symbols", "letter-like shapes"]
  },
  nursery_soft: {
    key: "nursery_soft",
    label: "Soft Nursery",
    description:
      "gentle nursery wall art, soft shapes, soothing pastel palette, child-friendly atmosphere, calm and warm",
    bestFor: ["nursery", "kids room"],
    avoid: ["scary imagery", "sharp contrast", "text"]
  },
  vintage_landscape: {
    key: "vintage_landscape",
    label: "Vintage Landscape",
    description:
      "timeless vintage-inspired landscape print, painterly texture, muted colors, nostalgic atmosphere, original composition",
    bestFor: ["living room", "study", "hallway"],
    avoid: ["specific artist imitation", "museum reproduction"]
  },
  islamic_geometry: {
    key: "islamic_geometry",
    label: "Islamic Geometry",
    description:
      "original geometric ornament inspired by traditional Islamic pattern principles, symmetrical, elegant, refined, no calligraphy or text",
    bestFor: ["prayer room", "living room", "hallway"],
    avoid: ["sacred text", "calligraphy", "brand marks"]
  },
  coastal_calm: {
    key: "coastal_calm",
    label: "Coastal Calm",
    description:
      "calm coastal wall art, soft ocean-inspired palette, airy composition, relaxed beach house decor aesthetic",
    bestFor: ["bathroom", "bedroom", "living room"],
    avoid: ["tourism logos", "text", "busy people"]
  },
  dark_academia: {
    key: "dark_academia",
    label: "Dark Academia",
    description:
      "moody scholarly vintage-inspired wall art, deep browns, antique paper tones, classic still life elements, original composition",
    bestFor: ["study", "library", "office"],
    avoid: ["readable book text", "specific copyrighted covers"]
  }
};

export const PALETTE_PRESETS: Record<PalettePresetKey, PalettePreset> = {
  warm_neutral_sage: {
    key: "warm_neutral_sage",
    label: "Warm Neutral + Sage",
    colors: ["warm beige", "ivory", "muted sage", "soft charcoal"]
  },
  terracotta_boho: {
    key: "terracotta_boho",
    label: "Terracotta Boho",
    colors: ["terracotta", "sand", "cream", "burnt orange", "clay brown"]
  },
  black_white_minimal: {
    key: "black_white_minimal",
    label: "Black & White Minimal",
    colors: ["black", "white", "warm gray"]
  },
  pastel_nursery: {
    key: "pastel_nursery",
    label: "Pastel Nursery",
    colors: ["soft peach", "powder blue", "cream", "pale sage"]
  },
  coastal_blue: {
    key: "coastal_blue",
    label: "Coastal Blue",
    colors: ["seafoam", "sand", "cream", "muted blue", "driftwood gray"]
  }
};

import { z } from "zod";

import {
  PRINT_RATIO_PRESET_KEYS,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import { PALETTE_PRESETS, STYLE_PRESETS } from "@/lib/prompts/presets";

const stylePresetKeys = Object.keys(STYLE_PRESETS) as [
  keyof typeof STYLE_PRESETS,
  ...Array<keyof typeof STYLE_PRESETS>
];

const palettePresetKeys = Object.keys(PALETTE_PRESETS) as [
  keyof typeof PALETTE_PRESETS,
  ...Array<keyof typeof PALETTE_PRESETS>
];

const ratioKeys = PRINT_RATIO_PRESET_KEYS as [
  PrintRatioPresetKey,
  ...PrintRatioPresetKey[]
];

export const promptInputSchema = z.object({
  packName: z.string().trim().min(2).max(80).optional(),
  subject: z.string().trim().min(3).max(180),
  niche: z.string().trim().max(80).optional(),
  room: z.string().trim().min(2).max(80),
  stylePresetKey: z.enum(stylePresetKeys),
  paletteKey: z.enum(palettePresetKeys),
  customPalette: z.string().trim().max(120).optional(),
  mood: z.string().trim().min(2).max(80),
  composition: z.string().trim().min(2).max(120),
  avoid: z.array(z.string().trim().min(1).max(40)).default([]),
  primaryRatio: z.enum(ratioKeys).default("2x3")
});

export type PromptInput = z.infer<typeof promptInputSchema>;

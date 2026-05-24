import { getPrintRatioPreset } from "@/lib/print/presets";
import { PALETTE_PRESETS, STYLE_PRESETS } from "@/lib/prompts/presets";
import { guardPromptInput } from "@/lib/prompts/guardrails";
import { promptInputSchema, type PromptInput } from "@/lib/prompts/schema";

export const GLOBAL_NEGATIVE_PROMPT =
  "No text, no words, no letters, no logo, no watermark, no signature, no frame, no border, no mat, no room, no wall, no furniture, no interior scene, no poster mockup, no product mockup, no photo of a print.";

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  primaryRatioLabel: string;
};

export function buildWallArtPrompt(input: PromptInput): BuiltPrompt {
  const parsed = promptInputSchema.parse(input);
  const guard = guardPromptInput(parsed);

  if (!guard.ok) {
    throw new PromptBlockedError(guard.message, guard);
  }

  const style = STYLE_PRESETS[parsed.stylePresetKey];
  const palette = PALETTE_PRESETS[parsed.paletteKey];
  const colors = parsed.customPalette?.trim() || palette.colors.join(", ");
  const ratio = getPrintRatioPreset(parsed.primaryRatio);
  const avoid = [...new Set([...parsed.avoid, ...style.avoid])].join(", ");
  const niche = parsed.niche ? `${parsed.niche} ` : "";

  return {
    primaryRatioLabel: ratio.label,
    negativePrompt: GLOBAL_NEGATIVE_PROMPT,
    prompt: [
      "Create a high-quality printable wall art image for an Etsy digital download product.",
      "Generate the artwork itself only as a flat, full-bleed printable image. Do not depict the buyer context, room, frame, wall, poster mockup, product photo, or any surrounding environment.",
      "",
      `Subject/theme: an original ${parsed.subject}`,
      `Target Etsy buyer context only, not visual content: suitable for ${niche}${parsed.room} decor`,
      `Style direction: ${style.description}`,
      `Color palette: ${colors}`,
      `Mood: ${parsed.mood}`,
      `Composition: ${parsed.composition}. Keep the main subject inside the central 80% safe area so the artwork can be cropped into multiple print ratios including ${ratio.label}.`,
      `Avoid: ${avoid}`,
      "",
      "Output requirements:",
      "single standalone artwork only, original design, printable wall art, clean composition, central safe area, high detail, tasteful negative space, crisp details, tasteful texture, balanced contrast.",
      GLOBAL_NEGATIVE_PROMPT
    ].join("\n")
  };
}

export class PromptBlockedError extends Error {
  constructor(
    message: string,
    public readonly details: Exclude<ReturnType<typeof guardPromptInput>, { ok: true }>
  ) {
    super(message);
    this.name = "PromptBlockedError";
  }
}

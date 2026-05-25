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

  return {
    primaryRatioLabel: ratio.label,
    negativePrompt: GLOBAL_NEGATIVE_PROMPT,
    prompt: [
      "Create a high-quality printable art file for an Etsy digital download product.",
      "Return the source artwork only: a flat, edge-to-edge image that fills the full canvas.",
      "The image must look like an original digital art file, not a photographed presentation scene or product listing image.",
      "",
      `Subject/theme: an original ${parsed.subject}`,
      `Style direction: ${style.description}`,
      `Color palette: ${colors}`,
      `Mood: ${parsed.mood}`,
      `Composition: ${parsed.composition}. Keep the main subject inside the central 80% safe area so the artwork works across all included print sizes in ${ratio.label}.`,
      `Avoid: ${avoid}`,
      "",
      "Output requirements:",
      "single standalone artwork file, original design, print-ready composition, central safe area, high detail, tasteful negative space, crisp details, tasteful texture, balanced contrast."
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

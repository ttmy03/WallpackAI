import type { FirestoreProject } from "@/lib/firestore/projects";
import { getPrintRatioPreset, type PrintRatioPresetKey } from "@/lib/print/presets";
import { PALETTE_PRESETS, STYLE_PRESETS } from "@/lib/prompts/presets";
import { guardPromptInput } from "@/lib/prompts/guardrails";
import { PromptBlockedError } from "@/lib/prompts/builder";

export function buildEtsyMockupPrompt(input: {
  project: FirestoreProject;
  ratioKey?: PrintRatioPresetKey | null;
}) {
  const promptInputs = input.project.promptInputs;
  const guard = guardPromptInput(promptInputs);

  if (!guard.ok) {
    throw new PromptBlockedError(guard.message, guard);
  }

  const style = STYLE_PRESETS[promptInputs.stylePresetKey];
  const palette = PALETTE_PRESETS[promptInputs.paletteKey];
  const colors =
    promptInputs.customPalette?.trim() || palette.colors.join(", ");
  const ratio = input.ratioKey ? getPrintRatioPreset(input.ratioKey) : null;

  return [
    "Create a square Etsy listing mockup image for a digital printable wall-art product using the reference artwork.",
    "Show the referenced artwork clearly as the main item in a tasteful room scene for an Etsy seller listing.",
    "",
    `Room or use case: ${promptInputs.room}.`,
    `Product theme: ${promptInputs.subject}.`,
    promptInputs.niche ? `Seller niche: ${promptInputs.niche}.` : null,
    `Style direction: ${style.description}.`,
    `Color palette: ${colors}.`,
    `Mood: ${promptInputs.mood}.`,
    ratio
      ? `Reference print ratio: ${ratio.label}; keep the artwork crop faithful to this ratio.`
      : "Keep the artwork crop faithful to the provided reference image.",
    "",
    "Composition requirements:",
    "square listing image, natural daylight, clean wall, realistic but understated decor, unbranded frame or print presentation, no packaging, no shipping materials, no hands, no price tags.",
    "The scene must communicate a digital download listing mockup only and must not imply that a physical frame or printed product is included.",
    "Preserve the referenced artwork's subject, palette, composition, and visual identity. Do not invent a different artwork.",
    "",
    "Strict exclusions:",
    "no text, no words, no letters, no logo, no watermark, no signature, no brand names, no celebrity likeness, no copyrighted characters, no franchise imagery, no protected artist imitation, no storefront signage."
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

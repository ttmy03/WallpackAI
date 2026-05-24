import { describe, expect, it } from "vitest";

import { createListingCopy } from "@/lib/etsy/listing-copy";
import { buildWallArtPrompt, PromptBlockedError } from "@/lib/prompts/builder";
import { guardPromptInput } from "@/lib/prompts/guardrails";
import type { PromptInput } from "@/lib/prompts/schema";

const safeInput: PromptInput = {
  packName: "Mountain calm set",
  subject: "minimalist mountain landscape",
  niche: "neutral printable art",
  room: "living room",
  stylePresetKey: "japandi_minimal",
  paletteKey: "warm_neutral_sage",
  mood: "calm and serene",
  composition: "centered with large negative space",
  avoid: ["people"],
  primaryRatio: "2x3"
};

describe("prompt guardrails and builder", () => {
  it("passes safe generic wall-art prompts", () => {
    expect(guardPromptInput(safeInput).ok).toBe(true);
  });

  it("builds prompts with required exclusions", () => {
    const built = buildWallArtPrompt(safeInput);

    expect(built.prompt).toContain("printable wall art");
    expect(built.prompt).toContain("central 80% safe area");
    expect(built.prompt).toContain("No text, no words, no letters");
    expect(built.negativePrompt).toContain("no logo");
  });

  it("blocks protected franchise prompts", () => {
    const result = guardPromptInput({
      ...safeInput,
      subject: "Disney princess nursery art"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("protected_brand_or_franchise");
    }
  });

  it("blocks living artist style imitation", () => {
    expect(() =>
      buildWallArtPrompt({
        ...safeInput,
        subject: "flowers in the style of Yayoi Kusama"
      })
    ).toThrow(PromptBlockedError);
  });

  it("keeps listing tags inside Etsy limits and includes AI disclosure by default", () => {
    const copy = createListingCopy({
      subject: "minimalist mountain landscape",
      styleLabel: "Japandi Minimal",
      ratios: ["2x3", "3x4", "4x5"]
    });

    expect(copy.tags).toHaveLength(13);
    expect(copy.tags.every((tag) => tag.length <= 20)).toBe(true);
    expect(copy.description).toContain("AI-assisted tools");
    expect(copy.aiDisclosureIncluded).toBe(true);
  });
});

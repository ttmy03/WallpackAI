import { describe, expect, it } from "vitest";

import type { FirestoreProject } from "@/lib/firestore/projects";
import { buildEtsyMockupPrompt } from "@/lib/prompts/mockups";
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
  avoid: ["text", "logos", "watermarks"],
  primaryRatio: "2x3"
};

describe("mockup prompt builder", () => {
  it("uses existing project room and seller context", () => {
    const prompt = buildEtsyMockupPrompt({
      project: projectFor(safeInput),
      ratioKey: "2x3"
    });

    expect(prompt).toContain("Room or use case: living room.");
    expect(prompt).toContain("Product theme: minimalist mountain landscape.");
    expect(prompt).toContain("Seller niche: neutral printable art.");
    expect(prompt).toContain("Reference print ratio: 2:3");
    expect(prompt).toContain("no text");
    expect(prompt).toContain("no logo");
    expect(prompt).toContain("must not imply that a physical frame");
  });

  it("blocks protected project context before provider work", () => {
    expect(() =>
      buildEtsyMockupPrompt({
        project: projectFor({
          ...safeInput,
          subject: "Disney princess nursery poster"
        }),
        ratioKey: "2x3"
      })
    ).toThrow(/protected brand/i);
  });
});

function projectFor(promptInputs: PromptInput): FirestoreProject {
  return {
    id: "prj_mockup_prompt",
    userId: "seller_1",
    name: promptInputs.packName ?? "Mockup prompt",
    status: "ready",
    niche: promptInputs.niche ?? null,
    theme: promptInputs.subject,
    stylePresetKey: promptInputs.stylePresetKey,
    paletteKey: promptInputs.paletteKey,
    customPalette: promptInputs.customPalette ?? null,
    promptInputs,
    printRatioKeys: ["2x3", "3x4", "4x5", "5x7", "11x14"],
    latestGenerationJobId: null,
    createdAt: "2026-05-30T10:00:00.000Z",
    updatedAt: "2026-05-30T10:00:00.000Z"
  };
}

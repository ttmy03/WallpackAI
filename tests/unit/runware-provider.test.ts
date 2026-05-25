import { describe, expect, it } from "vitest";

import {
  buildRunwareImageTask,
  buildRunwareUpscaleTask,
  RUNWARE_GPT_IMAGE_AIR_ID,
  RUNWARE_P_IMAGE_UPSCALE_AIR_ID,
  RunwareImageProvider,
  resolveRunwareDimensions
} from "@/lib/ai/providers/runware";

describe("Runware image provider", () => {
  it("uses GPT Image 2 as the default AIR model", () => {
    const task = buildRunwareImageTask(
      {
        prompt: "printable art file",
        negativePrompt: "wall, room, mockup",
        count: 2,
        aspectRatio: "2x3"
      },
      { taskUUID: "00000000-0000-4000-8000-000000000000" }
    );

    expect(task.model).toBe(RUNWARE_GPT_IMAGE_AIR_ID);
    expect(task.model).toBe("openai:gpt-image@2");
    expect(task.numberResults).toBe(2);
    expect(task.width).toBe(1664);
    expect(task.height).toBe(2496);
    expect(task.safety).toBe("fast");
    expect(task).not.toHaveProperty("providerSettings");
    expect(task).not.toHaveProperty("negativePrompt");
    expect(task.positivePrompt).toBe("printable art file");
    expect(task.positivePrompt).not.toContain("Avoid:");
    expect(task.positivePrompt).not.toContain("wall");
    expect(task.positivePrompt).not.toContain("mockup");
  });

  it("passes reference images through for GPT Image 2 image-to-image tasks", () => {
    const task = buildRunwareImageTask(
      {
        prompt: "create the same printable art in 3:4",
        count: 1,
        aspectRatio: "3x4",
        referenceImages: [
          " data:image/jpeg;base64,abc123 ",
          "",
          "https://example.test/source.jpg"
        ]
      },
      { taskUUID: "00000000-0000-4000-8000-000000000010" }
    );

    expect(task.model).toBe(RUNWARE_GPT_IMAGE_AIR_ID);
    expect(task.referenceImages).toEqual([
      "data:image/jpeg;base64,abc123",
      "https://example.test/source.jpg"
    ]);
    expect(task.width).toBe(1728);
    expect(task.height).toBe(2304);
  });

  it("maps common Etsy ratios to Runware-compatible dimensions", () => {
    expect(resolveRunwareDimensions({ aspectRatio: "3x4" })).toEqual({
      width: 1728,
      height: 2304
    });
    expect(resolveRunwareDimensions({ aspectRatio: "4:5" })).toEqual({
      width: 2048,
      height: 2560
    });
    expect(resolveRunwareDimensions({ aspectRatio: "11x14" })).toEqual({
      width: 2048,
      height: 2608
    });
    expect(resolveRunwareDimensions({ aspectRatio: "3x2" })).toEqual({
      width: 2496,
      height: 1664
    });
    expect(resolveRunwareDimensions({ aspectRatio: "14:11" })).toEqual({
      width: 2608,
      height: 2048
    });
  });

  it("accepts GPT Image 2 compatible dimensions", () => {
    expect(resolveRunwareDimensions({ width: 1024, height: 1024 })).toEqual({
      width: 1024,
      height: 1024
    });
  });

  it("rejects dimensions outside GPT Image 2 constraints", () => {
    expect(() => resolveRunwareDimensions({ width: 512, height: 512 })).toThrow(
      /655,360/
    );
    expect(() =>
      resolveRunwareDimensions({ width: 2200, height: 2800 })
    ).toThrow(/16 px steps/);
  });

  it("builds P-Image Upscale tasks without unsupported prompt fields", () => {
    const task = buildRunwareUpscaleTask(
      {
        image: "https://example.test/generated.jpg",
        sourceWidth: 1664,
        sourceHeight: 2496
      },
      { taskUUID: "00000000-0000-4000-8000-000000000001" }
    );

    expect(task.taskType).toBe("upscale");
    expect(task.model).toBe(RUNWARE_P_IMAGE_UPSCALE_AIR_ID);
    expect(task.model).toBe("prunaai:p-image@upscale");
    expect(task.inputs.image).toBe("https://example.test/generated.jpg");
    expect(task.targetMegapixels).toBe(8);
    expect(task.settings).toEqual({ enhanceDetails: true, realism: true });
    expect(task).not.toHaveProperty("positivePrompt");
    expect(task).not.toHaveProperty("negativePrompt");
  });

  it("runs GPT Image 2 generation without P-Image Upscale", async () => {
    const requests: unknown[] = [];
    const provider = new RunwareImageProvider({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        if (
          typeof input === "string" &&
          input.startsWith("https://image.test")
        ) {
          return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
        }

        const body = JSON.parse(String(init?.body)) as unknown[];
        requests.push(body[0]);

        return Response.json({
          data: [
            {
              taskType: "imageInference",
              taskUUID: "generation-task",
              imageUUID: "generated-image",
              imageURL: "https://image.test/generated.jpg",
              cost: 0.1
            }
          ]
        });
      }
    });

    const images = await provider.generate({
      prompt: "minimalist mountain landscape",
      negativePrompt: "no wall",
      count: 1,
      aspectRatio: "2x3"
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      taskType: "imageInference",
      model: RUNWARE_GPT_IMAGE_AIR_ID
    });
    expect(images[0]?.providerRequestId).toBe("generated-image");
    expect(images[0]?.usage?.generationTaskUUID).toBe("generation-task");
    expect(images[0]?.usage).not.toHaveProperty("upscaleTaskUUID");
    expect(images[0]?.usage).not.toHaveProperty("upscaleModel");
    expect(images[0]?.width).toBe(1664);
    expect(images[0]?.height).toBe(2496);
  });

  it("surfaces Runware HTTP error details without hiding them behind the status", async () => {
    const provider = new RunwareImageProvider({
      apiKey: "test-key",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            errors: [
              {
                code: "invalidParameter",
                message: "negativePrompt is not allowed",
                parameter: "negativePrompt"
              }
            ]
          }),
          { status: 400 }
        )
    });

    await expect(
      provider.generate({
        prompt: "printable art file",
        count: 1,
        aspectRatio: "2x3"
      })
    ).rejects.toThrow(
      /HTTP 400: negativePrompt is not allowed \(negativePrompt\)/
    );
  });
});

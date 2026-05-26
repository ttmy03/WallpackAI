import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  buildRunwareImageTask,
  buildRunwareUpscaleTask,
  RUNWARE_GPT_IMAGE_AIR_ID,
  RUNWARE_P_IMAGE_UPSCALE_AIR_ID,
  RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS,
  RunwareImageProvider,
  RunwareUpscaleProvider,
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
      width: 1824,
      height: 2288
    });
    expect(resolveRunwareDimensions({ aspectRatio: "11x14" })).toEqual({
      width: 1808,
      height: 2304
    });
    expect(resolveRunwareDimensions({ aspectRatio: "3x2" })).toEqual({
      width: 2496,
      height: 1664
    });
    expect(resolveRunwareDimensions({ aspectRatio: "14:11" })).toEqual({
      width: 2304,
      height: 1808
    });
    expect(
      [
        "1x1",
        "2x3",
        "3x4",
        "4x5",
        "5x7",
        "11x14",
        "iso-a",
        "3x2",
        "4x3",
        "5x4",
        "7x5",
        "14x11",
        "iso-a-landscape"
      ].every((aspectRatio) => {
        const dimensions = resolveRunwareDimensions({ aspectRatio });

        return (
          dimensions.width * dimensions.height <=
          RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS
        );
      })
    ).toBe(true);
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

  it("returns actual P-Image output dimensions from downloaded bytes", async () => {
    const requests: unknown[] = [];
    const provider = new RunwareUpscaleProvider({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        if (
          typeof input === "string" &&
          input.startsWith("https://image.test")
        ) {
          return new Response(testPngBytes(1234, 1851));
        }

        const body = JSON.parse(String(init?.body)) as unknown[];
        requests.push(body[0]);

        return Response.json({
          data: [
            {
              taskType: "upscale",
              taskUUID: "upscale-task",
              imageUUID: "upscaled-image",
              imageURL: "https://image.test/upscaled.png",
              cost: 0.01
            }
          ]
        });
      }
    });

    const image = await provider.upscale({
      bytes: testPngBytes(100, 150),
      mimeType: "image/png",
      width: 100,
      height: 150,
      targetWidth: 7200,
      targetHeight: 10800
    });

    expect(requests[0]).toMatchObject({
      taskType: "upscale",
      model: RUNWARE_P_IMAGE_UPSCALE_AIR_ID,
      targetMegapixels: 8
    });
    expect(image).toMatchObject({
      mimeType: "image/png",
      width: 1234,
      height: 1851,
      providerRequestId: "upscaled-image"
    });
  });

  it("uses a Runware image UUID for P-Image input when available", async () => {
    const requests: Array<{ inputs?: { image?: string } }> = [];
    const provider = new RunwareUpscaleProvider({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        if (
          typeof input === "string" &&
          input.startsWith("https://image.test")
        ) {
          return new Response(testPngBytes(1234, 1851));
        }

        const body = JSON.parse(String(init?.body)) as Array<{
          inputs?: { image?: string };
        }>;
        requests.push(body[0]);

        return Response.json({
          data: [
            {
              taskType: "upscale",
              taskUUID: "upscale-task",
              imageUUID: "upscaled-image",
              imageURL: "https://image.test/upscaled.png",
              cost: 0.01
            }
          ]
        });
      }
    });

    await provider.upscale({
      bytes: testPngBytes(100, 150),
      mimeType: "image/png",
      width: 100,
      height: 150,
      providerImageId: "c5875405-da40-4d09-9244-c514674b9f7d",
      targetWidth: 7200,
      targetHeight: 10800
    });

    expect(requests[0]?.inputs?.image).toBe(
      "c5875405-da40-4d09-9244-c514674b9f7d"
    );
  });

  it("resizes oversized P-Image inputs before sending them to Runware", async () => {
    const requests: Array<{ inputs?: { image?: string } }> = [];
    const provider = new RunwareUpscaleProvider({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        if (
          typeof input === "string" &&
          input.startsWith("https://image.test")
        ) {
          return new Response(testPngBytes(1234, 1851));
        }

        const body = JSON.parse(String(init?.body)) as Array<{
          inputs?: { image?: string };
        }>;
        requests.push(body[0]);

        return Response.json({
          data: [
            {
              taskType: "upscale",
              taskUUID: "upscale-task",
              imageUUID: "upscaled-image",
              imageURL: "https://image.test/upscaled.png",
              cost: 0.01
            }
          ]
        });
      }
    });
    const sourceBytes = await sharp({
      create: {
        width: 2048,
        height: 2560,
        channels: 3,
        background: { r: 120, g: 140, b: 180 }
      }
    })
      .png()
      .toBuffer();
    const image = await provider.upscale({
      bytes: sourceBytes,
      mimeType: "image/png",
      width: 2048,
      height: 2560,
      providerImageId: "c5875405-da40-4d09-9244-c514674b9f7d",
      targetWidth: 4800,
      targetHeight: 6000
    });

    expect(requests[0]?.inputs?.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(requests[0]?.inputs?.image).not.toBe(
      "c5875405-da40-4d09-9244-c514674b9f7d"
    );
    expect(image.usage).toMatchObject({
      upscaleInputResized: true,
      upscaleInputWidth: 1831,
      upscaleInputHeight: 2289
    });
    expect(
      Number(image.usage?.upscaleInputWidth) *
        Number(image.usage?.upscaleInputHeight)
    ).toBeLessThanOrEqual(RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS);
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

function testPngBytes(width: number, height: number) {
  const bytes = new Uint8Array(24);

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32Be(bytes, width, 16);
  writeUint32Be(bytes, height, 20);

  return bytes;
}

function writeUint32Be(bytes: Uint8Array, value: number, offset: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

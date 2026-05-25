import { describe, expect, it } from "vitest";

import { MockImageProvider } from "@/lib/ai/providers/mock";

describe("Mock image provider", () => {
  it("returns visible PNG previews with real dimensions", async () => {
    const provider = new MockImageProvider();
    const [image] = await provider.generate({
      prompt: "minimalist mountain landscape printable wall art",
      count: 1,
      width: 96,
      height: 144
    });

    expect(image.mimeType).toBe("image/png");
    expect(image.width).toBe(96);
    expect(image.height).toBe(144);
    expect(Buffer.from(image.bytes.subarray(0, 8))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(image.bytes.byteLength).toBeGreaterThan(500);
  });

  it("returns landscape previews for landscape ratio requests", async () => {
    const provider = new MockImageProvider();
    const [image] = await provider.generate({
      prompt: "minimalist mountain landscape printable wall art",
      count: 1,
      aspectRatio: "3x2"
    });

    expect(image.width).toBe(1296);
    expect(image.height).toBe(864);
    expect(image.width).toBeGreaterThan(image.height);
  });

  it("marks reference-guided mock generations", async () => {
    const provider = new MockImageProvider();
    const [image] = await provider.generate({
      prompt: "same artwork in 3:4",
      count: 1,
      aspectRatio: "3x4",
      referenceImages: ["data:image/png;base64,abc123"]
    });

    expect(image.providerRequestId).toBe("mock-reference-image-1");
    expect(image.usage?.referenceImageCount).toBe(1);
  });
});

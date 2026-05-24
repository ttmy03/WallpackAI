import type { GeneratedImage, GenerateImageInput, ImageProvider } from "@/lib/ai/image-provider";

const ONE_BY_ONE_TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

export class MockImageProvider implements ImageProvider {
  async generate(input: GenerateImageInput): Promise<GeneratedImage[]> {
    return Array.from({ length: input.count }, (_, index) => ({
      bytes: ONE_BY_ONE_TRANSPARENT_PNG,
      mimeType: "image/png" as const,
      width: input.width ?? 1024,
      height: input.height ?? 1536,
      providerRequestId: `mock-image-${index + 1}`,
      usage: {
        model: "mock",
        cost: 0
      }
    }));
  }
}

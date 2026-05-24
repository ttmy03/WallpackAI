import type {
  UpscaledImage,
  UpscaleImageInput,
  UpscaleProvider
} from "@/lib/ai/upscale-provider";

export class MockUpscaleProvider implements UpscaleProvider {
  async upscale(input: UpscaleImageInput): Promise<UpscaledImage> {
    return {
      ...input,
      providerRequestId: "mock-upscale",
      usage: {
        model: "mock-upscale",
        cost: 0
      }
    };
  }
}

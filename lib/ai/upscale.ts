import type { UpscaleProvider } from "@/lib/ai/upscale-provider";
import { MockUpscaleProvider } from "@/lib/ai/providers/mock-upscale";
import { RunwareUpscaleProvider } from "@/lib/ai/providers/runware";

let upscaleProvider: UpscaleProvider | null | undefined;

export function getUpscaleProvider(): UpscaleProvider | null {
  if (upscaleProvider !== undefined) {
    return upscaleProvider;
  }

  const provider = process.env.UPSCALE_PROVIDER ?? "runware";

  if (provider === "none") {
    upscaleProvider = null;
    return upscaleProvider;
  }

  if (provider === "mock") {
    upscaleProvider = new MockUpscaleProvider();
    return upscaleProvider;
  }

  if (provider === "runware") {
    upscaleProvider = new RunwareUpscaleProvider();
    return upscaleProvider;
  }

  throw new Error(`Unsupported UPSCALE_PROVIDER: ${provider}`);
}

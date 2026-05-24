import type { ImageProvider } from "@/lib/ai/image-provider";
import { MockImageProvider } from "@/lib/ai/providers/mock";
import { RunwareImageProvider } from "@/lib/ai/providers/runware";

let imageProvider: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (imageProvider) {
    return imageProvider;
  }

  const provider = process.env.IMAGE_PROVIDER ?? "mock";

  if (provider === "mock") {
    imageProvider = new MockImageProvider();
    return imageProvider;
  }

  if (provider === "runware") {
    imageProvider = new RunwareImageProvider();
    return imageProvider;
  }

  throw new Error(`Unsupported IMAGE_PROVIDER: ${provider}`);
}

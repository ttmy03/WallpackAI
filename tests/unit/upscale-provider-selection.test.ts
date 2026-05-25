import { afterEach, describe, expect, it, vi } from "vitest";

const originalImageProvider = process.env.IMAGE_PROVIDER;
const originalUpscaleProvider = process.env.UPSCALE_PROVIDER;

describe("upscale provider selection", () => {
  afterEach(() => {
    restoreEnv("IMAGE_PROVIDER", originalImageProvider);
    restoreEnv("UPSCALE_PROVIDER", originalUpscaleProvider);
    vi.resetModules();
  });

  it("defaults to sharp-only exports without AI upscaling", async () => {
    process.env.IMAGE_PROVIDER = "runware";
    delete process.env.UPSCALE_PROVIDER;

    const { getUpscaleProvider } = await import("@/lib/ai/upscale");

    expect(getUpscaleProvider()).toBeNull();
  });

  it("allows explicitly opting into a mock upscale provider", async () => {
    process.env.UPSCALE_PROVIDER = "mock";

    const { getUpscaleProvider } = await import("@/lib/ai/upscale");
    const provider = getUpscaleProvider();

    expect(provider).not.toBeNull();
    await expect(
      provider?.upscale({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        width: 100,
        height: 150,
        targetWidth: 1000,
        targetHeight: 1500
      })
    ).resolves.toMatchObject({
      usage: {
        model: "mock-upscale"
      }
    });
  });

  it("allows explicitly opting into Runware P-Image Upscale", async () => {
    process.env.UPSCALE_PROVIDER = "runware";

    const { getUpscaleProvider } = await import("@/lib/ai/upscale");
    const { RunwareUpscaleProvider } = await import(
      "@/lib/ai/providers/runware"
    );

    expect(getUpscaleProvider()).toBeInstanceOf(RunwareUpscaleProvider);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

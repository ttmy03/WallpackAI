import { describe, expect, it } from "vitest";

import { MockImageProvider } from "@/lib/ai/providers/mock";
import type {
  UpscaledImage,
  UpscaleImageInput,
  UpscaleProvider
} from "@/lib/ai/upscale-provider";
import { buildPrintFiles } from "@/lib/export/pack-builder";

class RecordingUpscaleProvider implements UpscaleProvider {
  readonly calls: UpscaleImageInput[] = [];

  async upscale(input: UpscaleImageInput): Promise<UpscaledImage> {
    this.calls.push(input);

    return {
      ...input,
      providerRequestId: `upscale-${this.calls.length}`,
      usage: {
        model: "recording-upscale",
        call: this.calls.length,
        targetWidth: input.targetWidth,
        targetHeight: input.targetHeight
      }
    };
  }
}

describe("print pack builder", () => {
  it("upscales each requested print dimension independently", async () => {
    const [source] = await new MockImageProvider().generate({
      prompt: "minimalist mountain landscape",
      count: 1,
      aspectRatio: "2x3"
    });
    const upscaleProvider = new RecordingUpscaleProvider();
    const result = await buildPrintFiles({
      sourceBytes: Buffer.from(source.bytes),
      sourceMimeType: source.mimeType,
      sourceWidth: source.width,
      sourceHeight: source.height,
      ratioKeys: ["2x3", "3x4"],
      upscaleProvider
    });

    expect(upscaleProvider.calls).toHaveLength(2);
    expect(upscaleProvider.calls[0]).toMatchObject({
      targetWidth: 7200,
      targetHeight: 10800
    });
    expect(upscaleProvider.calls[1]).toMatchObject({
      targetWidth: 5400,
      targetHeight: 7200
    });
    expect(upscaleProvider.calls[0]?.width).not.toBe(
      upscaleProvider.calls[1]?.width
    );
    expect(result.files.map((file) => file.ratioKey)).toEqual(["2x3", "3x4"]);
    expect(result.files[0]).toMatchObject({
      ratioKey: "2x3",
      width: 7200,
      height: 10800,
      upscaleProvider: "recording-upscale"
    });
    expect(result.upscaleUsage?.mode).toBe("per-ratio");
  }, 20_000);

  it("uses ratio-specific generated sources when they are available", async () => {
    const provider = new MockImageProvider();
    const [primarySource] = await provider.generate({
      prompt: "minimalist mountain landscape",
      count: 1,
      aspectRatio: "2x3"
    });
    const [ratioSource] = await provider.generate({
      prompt: "minimalist mountain landscape",
      count: 1,
      aspectRatio: "3x4"
    });
    const upscaleProvider = new RecordingUpscaleProvider();

    await buildPrintFiles({
      sourceBytes: Buffer.from(primarySource.bytes),
      sourceMimeType: primarySource.mimeType,
      sourceWidth: primarySource.width,
      sourceHeight: primarySource.height,
      ratioKeys: ["2x3", "3x4"],
      ratioSources: {
        "3x4": {
          bytes: Buffer.from(ratioSource.bytes),
          mimeType: ratioSource.mimeType,
          width: ratioSource.width,
          height: ratioSource.height
        }
      },
      upscaleProvider
    });

    expect(upscaleProvider.calls).toHaveLength(2);
    expect(upscaleProvider.calls[0]).toMatchObject({
      width: 864,
      height: 1296,
      targetWidth: 7200,
      targetHeight: 10800
    });
    expect(upscaleProvider.calls[1]).toMatchObject({
      width: 900,
      height: 1200,
      targetWidth: 5400,
      targetHeight: 7200
    });
  }, 20_000);
});

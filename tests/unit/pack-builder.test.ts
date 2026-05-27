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
    const callNumber = this.calls.length;

    return {
      ...input,
      width: input.width * 2,
      height: input.height * 2,
      providerRequestId: `upscale-${callNumber}`,
      usage: {
        model: "recording-upscale",
        call: callNumber,
        targetWidth: input.targetWidth,
        targetHeight: input.targetHeight
      }
    };
  }
}

describe("print pack builder", () => {
  it("uses AI-upscaled output directly without sharp-enlarging to print dimensions", async () => {
    const provider = new MockImageProvider();
    const [source] = await provider.generate({
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
    const result = await buildPrintFiles({
      sourceBytes: Buffer.from(source.bytes),
      sourceMimeType: source.mimeType,
      sourceWidth: source.width,
      sourceHeight: source.height,
      sourceProviderRequestId: "primary-runware-image",
      ratioKeys: ["2x3", "3x4"],
      ratioSources: {
        "3x4": {
          bytes: Buffer.from(ratioSource.bytes),
          mimeType: ratioSource.mimeType,
          width: ratioSource.width,
          height: ratioSource.height,
          providerRequestId: "ratio-runware-image"
        }
      },
      upscaleProvider
    });

    expect(upscaleProvider.calls).toHaveLength(2);
    expect(upscaleProvider.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetWidth: 7200,
          targetHeight: 10800
        }),
        expect.objectContaining({
          targetWidth: 5400,
          targetHeight: 7200
        })
      ])
    );
    const twoByThreeCall = upscaleProvider.calls.find(
      (call) => call.targetWidth === 7200 && call.targetHeight === 10800
    );
    const threeByFourCall = upscaleProvider.calls.find(
      (call) => call.targetWidth === 5400 && call.targetHeight === 7200
    );
    expect(twoByThreeCall).toMatchObject({
      mimeType: "image/png",
      width: 864,
      height: 1296,
      targetWidth: 7200,
      targetHeight: 10800,
      providerImageId: "primary-runware-image"
    });
    expect(threeByFourCall).toMatchObject({
      width: 900,
      height: 1200,
      targetWidth: 5400,
      targetHeight: 7200,
      providerImageId: "ratio-runware-image"
    });
    expect(twoByThreeCall?.width).not.toBe(threeByFourCall?.width);
    expect(result.files.map((file) => file.ratioKey)).toEqual(["2x3", "3x4"]);
    expect(result.files[0]).toMatchObject({
      ratioKey: "2x3",
      width: 1728,
      height: 2592,
      upscaleProvider: "recording-upscale"
    });
    expect(result.upscaleUsage?.mode).toBe("per-ratio");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("AI upscale finished")])
    );
    expect(result.warnings).toHaveLength(1);
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
      sourceProviderRequestId: "primary-runware-image",
      ratioKeys: ["2x3", "3x4"],
      ratioSources: {
        "3x4": {
          bytes: Buffer.from(ratioSource.bytes),
          mimeType: ratioSource.mimeType,
          width: ratioSource.width,
          height: ratioSource.height,
          providerRequestId: "ratio-runware-image"
        }
      },
      upscaleProvider
    });

    expect(upscaleProvider.calls).toHaveLength(2);
    expect(upscaleProvider.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 864,
          height: 1296,
          targetWidth: 7200,
          targetHeight: 10800,
          providerImageId: "primary-runware-image"
        }),
        expect.objectContaining({
          width: 900,
          height: 1200,
          targetWidth: 5400,
          targetHeight: 7200,
          providerImageId: "ratio-runware-image"
        })
      ])
    );
    expect(
      upscaleProvider.calls.find(
        (call) => call.targetWidth === 7200 && call.targetHeight === 10800
      )
    ).toMatchObject({
      mimeType: "image/png",
      width: 864,
      height: 1296,
      targetWidth: 7200,
      targetHeight: 10800,
      providerImageId: "primary-runware-image"
    });
    expect(
      upscaleProvider.calls.find(
        (call) => call.targetWidth === 5400 && call.targetHeight === 7200
      )
    ).toMatchObject({
      mimeType: "image/png",
      width: 900,
      height: 1200,
      targetWidth: 5400,
      targetHeight: 7200,
      providerImageId: "ratio-runware-image"
    });
  }, 20_000);

  it("does not sharp-reframe a mismatched source before AI upscaling", async () => {
    const [source] = await new MockImageProvider().generate({
      prompt: "minimalist mountain landscape",
      count: 1,
      aspectRatio: "2x3"
    });
    const upscaleProvider = new RecordingUpscaleProvider();

    await expect(
      buildPrintFiles({
        sourceBytes: Buffer.from(source.bytes),
        sourceMimeType: source.mimeType,
        sourceWidth: source.width,
        sourceHeight: source.height,
        ratioKeys: ["3x4"],
        upscaleProvider
      })
    ).rejects.toThrow(/ratio-specific generated source/);
    expect(upscaleProvider.calls).toHaveLength(0);
  }, 20_000);

  it("reports each built print file for export job progress", async () => {
    const [source] = await new MockImageProvider().generate({
      prompt: "minimalist mountain landscape",
      count: 1,
      aspectRatio: "2x3"
    });
    const builtRatioKeys: string[] = [];

    await buildPrintFiles({
      sourceBytes: Buffer.from(source.bytes),
      sourceMimeType: source.mimeType,
      sourceWidth: source.width,
      sourceHeight: source.height,
      ratioKeys: ["2x3", "3x4"],
      onFileBuilt: (file) => {
        builtRatioKeys.push(file.ratioKey);
      }
    });

    expect([...builtRatioKeys].sort()).toEqual(["2x3", "3x4"]);
  }, 20_000);
});

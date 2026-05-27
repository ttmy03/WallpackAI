import { describe, expect, it } from "vitest";
import sharp from "sharp";

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
  it("renders AI-upscaled sources to exact 300 DPI print dimensions", async () => {
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
      fileName: "2x3_24x36in_300dpi.jpg",
      width: 7200,
      height: 10800,
      workingWidth: 1728,
      workingHeight: 2592,
      upscaleProvider: "recording-upscale"
    });
    expect(result.files[1]).toMatchObject({
      ratioKey: "3x4",
      fileName: "3x4_18x24in_300dpi.jpg",
      width: 5400,
      height: 7200,
      workingWidth: 1800,
      workingHeight: 2400,
      upscaleProvider: "recording-upscale"
    });
    await expectPrintJpegMetadata(result.files[0].bytes, {
      width: 7200,
      height: 10800,
      density: 300
    });
    expect(result.upscaleUsage?.mode).toBe("per-ratio");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("was enlarged")])
    );
    expect(result.warnings).toHaveLength(2);
  }, 60_000);

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
      ratioKeys: ["3x4"],
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

    expect(upscaleProvider.calls).toHaveLength(1);
    expect(upscaleProvider.calls).toEqual(
      expect.arrayContaining([
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
  }, 60_000);

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

async function expectPrintJpegMetadata(
  bytes: Buffer,
  expected: { width: number; height: number; density: number }
) {
  const metadata = await sharp(bytes).metadata();

  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBe(expected.width);
  expect(metadata.height).toBe(expected.height);
  expect(metadata.density).toBe(expected.density);
}

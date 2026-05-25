export type PixelSize = {
  width: number;
  height: number;
};

export type ContainedImageFrame = PixelSize & {
  left: number;
  top: number;
};

/**
 * Calculates the largest centered frame that fits a source image inside a fixed
 * canvas without cropping any source pixels.
 */
export function fitImageWithinCanvas(
  source: PixelSize,
  canvas: PixelSize
): ContainedImageFrame {
  assertPositivePixelSize("source", source);
  assertPositivePixelSize("canvas", canvas);

  const scale = Math.min(
    canvas.width / source.width,
    canvas.height / source.height
  );
  const width = clampPixelDimension(
    Math.round(source.width * scale),
    canvas.width
  );
  const height = clampPixelDimension(
    Math.round(source.height * scale),
    canvas.height
  );

  return {
    width,
    height,
    left: Math.floor((canvas.width - width) / 2),
    top: Math.floor((canvas.height - height) / 2)
  };
}

function assertPositivePixelSize(name: string, size: PixelSize) {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error(`${name} dimensions must be positive finite pixels.`);
  }
}

function clampPixelDimension(value: number, max: number) {
  return Math.max(1, Math.min(max, value));
}

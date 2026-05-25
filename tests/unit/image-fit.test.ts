import { describe, expect, it } from "vitest";

import { fitImageWithinCanvas } from "@/lib/image/fit";

describe("image fit", () => {
  it("fits a portrait source into a wider portrait ratio without top or bottom crop", () => {
    expect(
      fitImageWithinCanvas(
        { width: 200, height: 300 },
        { width: 300, height: 400 }
      )
    ).toEqual({
      width: 267,
      height: 400,
      left: 16,
      top: 0
    });
  });

  it("fits a landscape source into a taller landscape ratio without side crop", () => {
    expect(
      fitImageWithinCanvas(
        { width: 300, height: 200 },
        { width: 400, height: 300 }
      )
    ).toEqual({
      width: 400,
      height: 267,
      left: 0,
      top: 16
    });
  });

  it("fills the canvas when source and target ratios match", () => {
    expect(
      fitImageWithinCanvas(
        { width: 200, height: 300 },
        { width: 7200, height: 10800 }
      )
    ).toEqual({
      width: 7200,
      height: 10800,
      left: 0,
      top: 0
    });
  });

  it("rejects invalid dimensions", () => {
    expect(() =>
      fitImageWithinCanvas(
        { width: 0, height: 300 },
        { width: 300, height: 400 }
      )
    ).toThrow("source dimensions must be positive finite pixels.");
  });
});

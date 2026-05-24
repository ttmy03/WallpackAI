import { describe, expect, it } from "vitest";

import {
  buildRunwareImageTask,
  resolveRunwareDimensions,
  RUNWARE_SEEDREAM_AIR_ID
} from "@/lib/ai/providers/runware";

describe("Runware image provider", () => {
  it("uses Seedream 4.5 as the default AIR model", () => {
    const task = buildRunwareImageTask(
      {
        prompt: "printable wall art",
        negativePrompt: "text, logo",
        count: 2,
        aspectRatio: "2x3"
      },
      { taskUUID: "00000000-0000-4000-8000-000000000000" }
    );

    expect(task.model).toBe(RUNWARE_SEEDREAM_AIR_ID);
    expect(task.model).toBe("bytedance:seedream@4.5");
    expect(task.numberResults).toBe(2);
    expect(task.width).toBe(1664);
    expect(task.height).toBe(2496);
    expect(task.negativePrompt).toBe("text, logo");
  });

  it("maps common Etsy ratios to Seedream-compatible dimensions", () => {
    expect(resolveRunwareDimensions({ aspectRatio: "3x4" })).toEqual({
      width: 1728,
      height: 2304
    });
    expect(resolveRunwareDimensions({ aspectRatio: "4:5" })).toEqual({
      width: 2048,
      height: 2560
    });
  });

  it("rejects dimensions below Seedream 4.5 minimum area", () => {
    expect(() => resolveRunwareDimensions({ width: 1024, height: 1024 })).toThrow(
      /3,686,400/
    );
  });
});

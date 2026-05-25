import { describe, expect, it } from "vitest";

import { isStaleExportJobView } from "@/lib/jobs/local-export-runner";

describe("export job timeout detection", () => {
  it("marks non-terminal jobs stale after the timeout window", () => {
    expect(
      isStaleExportJobView(
        {
          status: "uploading",
          createdAt: "2026-05-24T10:00:00.000Z",
          startedAt: "2026-05-24T10:01:00.000Z",
          updatedAt: "2026-05-24T10:05:00.000Z"
        },
        {
          now: new Date("2026-05-24T10:21:00.000Z"),
          timeoutMs: 15 * 60 * 1000
        }
      )
    ).toBe(true);
  });

  it("does not mark terminal jobs stale", () => {
    expect(
      isStaleExportJobView(
        {
          status: "failed",
          createdAt: "2026-05-24T10:00:00.000Z",
          startedAt: "2026-05-24T10:01:00.000Z",
          updatedAt: "2026-05-24T10:05:00.000Z"
        },
        {
          now: new Date("2026-05-24T11:00:00.000Z"),
          timeoutMs: 15 * 60 * 1000
        }
      )
    ).toBe(false);
  });
});

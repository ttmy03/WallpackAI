import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/lib/api-response";

const mocks = vi.hoisted(() => ({
  downloadLocalMockupArtifactForUser: vi.fn(),
  requireAppUser: vi.fn()
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAppUser: mocks.requireAppUser
}));

vi.mock("@/lib/jobs/local-mockup-runner", () => ({
  downloadLocalMockupArtifactForUser:
    mocks.downloadLocalMockupArtifactForUser
}));

const route = await import(
  "@/app/api/app/mockup-jobs/[jobId]/artifacts/[artifactId]/download/route"
);

describe("mockup artifact download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      ok: true,
      firestoreUser: { id: "user_1" }
    });
  });

  it("streams an owned mockup ZIP artifact with attachment headers", async () => {
    const bytes = Buffer.from("zip-bytes");
    mocks.downloadLocalMockupArtifactForUser.mockResolvedValue({
      fileName: "WallPackAI_Mockups.zip",
      contentType: "application/zip",
      bytes
    });

    const response = await route.GET(
      new Request("http://localhost/api/download"),
      {
        params: Promise.resolve({
          jobId: "mck_1",
          artifactId: "mcka_1"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-length")).toBe(
      bytes.byteLength.toString()
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="WallPackAI_Mockups.zip"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "zip-bytes"
    );
    expect(mocks.downloadLocalMockupArtifactForUser).toHaveBeenCalledWith({
      jobId: "mck_1",
      artifactId: "mcka_1",
      userId: "user_1"
    });
  });

  it("returns 404 when the mockup artifact is not owned or missing", async () => {
    mocks.downloadLocalMockupArtifactForUser.mockResolvedValue(null);

    const response = await route.GET(
      new Request("http://localhost/api/download"),
      {
        params: Promise.resolve({
          jobId: "mck_1",
          artifactId: "mcka_missing"
        })
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(
      fail("MOCKUP_ARTIFACT_NOT_FOUND", "Mockup file was not found.")
    );
  });
});

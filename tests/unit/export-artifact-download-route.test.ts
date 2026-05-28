import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/lib/api-response";

const mocks = vi.hoisted(() => ({
  downloadLocalExportArtifactForUser: vi.fn(),
  requireAppUser: vi.fn()
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAppUser: mocks.requireAppUser
}));

vi.mock("@/lib/jobs/local-export-runner", () => ({
  downloadLocalExportArtifactForUser:
    mocks.downloadLocalExportArtifactForUser
}));

const route = await import(
  "@/app/api/app/export-jobs/[jobId]/artifacts/[artifactId]/download/route"
);

describe("export artifact download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      ok: true,
      firestoreUser: { id: "user_1" }
    });
  });

  it("streams an owned ZIP artifact with attachment headers", async () => {
    const bytes = Buffer.from("zip-bytes");
    mocks.downloadLocalExportArtifactForUser.mockResolvedValue({
      fileName: "WallPackAI_PrintFiles_1.zip",
      contentType: "application/zip",
      bytes
    });

    const response = await route.GET(
      new Request("http://localhost/api/download"),
      {
        params: Promise.resolve({
          jobId: "exp_1",
          artifactId: "artf_1"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-length")).toBe(
      bytes.byteLength.toString()
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="WallPackAI_PrintFiles_1.zip"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "zip-bytes"
    );
    expect(mocks.downloadLocalExportArtifactForUser).toHaveBeenCalledWith({
      jobId: "exp_1",
      artifactId: "artf_1",
      userId: "user_1"
    });
  });

  it("returns 404 when the artifact is not owned or missing", async () => {
    mocks.downloadLocalExportArtifactForUser.mockResolvedValue(null);

    const response = await route.GET(
      new Request("http://localhost/api/download"),
      {
        params: Promise.resolve({
          jobId: "exp_1",
          artifactId: "artf_missing"
        })
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(
      fail("EXPORT_ARTIFACT_NOT_FOUND", "Export file was not found.")
    );
  });
});

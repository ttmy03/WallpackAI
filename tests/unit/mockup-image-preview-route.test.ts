import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/lib/api-response";

const mocks = vi.hoisted(() => ({
  downloadLocalMockupImageForUser: vi.fn(),
  requireAppUser: vi.fn()
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAppUser: mocks.requireAppUser
}));

vi.mock("@/lib/jobs/local-mockup-runner", () => ({
  downloadLocalMockupImageForUser: mocks.downloadLocalMockupImageForUser
}));

const route = await import(
  "@/app/api/app/mockup-jobs/[jobId]/images/[imageId]/preview/route"
);

describe("mockup image preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      ok: true,
      firestoreUser: { id: "user_1" }
    });
  });

  it("streams an owned mockup image inline", async () => {
    const bytes = Buffer.from("image-bytes");
    mocks.downloadLocalMockupImageForUser.mockResolvedValue({
      fileName: "mockup-1.png",
      contentType: "image/png",
      bytes
    });

    const response = await route.GET(
      new Request("http://localhost/api/preview"),
      {
        params: Promise.resolve({
          jobId: "mck_1",
          imageId: "mcki_1"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(
      bytes.byteLength.toString()
    );
    expect(response.headers.get("content-disposition")).toContain(
      'inline; filename="mockup-1.png"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "image-bytes"
    );
    expect(mocks.downloadLocalMockupImageForUser).toHaveBeenCalledWith({
      jobId: "mck_1",
      imageId: "mcki_1",
      userId: "user_1"
    });
  });

  it("returns 404 when the mockup image is not owned or missing", async () => {
    mocks.downloadLocalMockupImageForUser.mockResolvedValue(null);

    const response = await route.GET(
      new Request("http://localhost/api/preview"),
      {
        params: Promise.resolve({
          jobId: "mck_1",
          imageId: "mcki_missing"
        })
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(
      fail("MOCKUP_IMAGE_NOT_FOUND", "Mockup preview was not found.")
    );
  });
});

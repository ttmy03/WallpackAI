import { describe, expect, it } from "vitest";

import { readApiResponse } from "@/lib/app/api-client";
import { fail, ok } from "@/lib/api-response";

describe("API client response parsing", () => {
  it("parses WallPack API success responses", async () => {
    await expect(
      readApiResponse<{ creditBalance: number }>(
        Response.json(ok({ creditBalance: 12 }))
      )
    ).resolves.toEqual(ok({ creditBalance: 12 }));
  });

  it("parses WallPack API error responses", async () => {
    await expect(
      readApiResponse(
        Response.json(
          fail("UNAUTHENTICATED", "A Firebase ID token is required."),
          {
            status: 401
          }
        )
      )
    ).resolves.toEqual(
      fail("UNAUTHENTICATED", "A Firebase ID token is required.")
    );
  });

  it("throws an actionable error for empty API responses", async () => {
    await expect(
      readApiResponse(new Response(null, { status: 500 }))
    ).rejects.toThrow(
      "API request failed with HTTP 500 and returned an empty response."
    );
  });

  it("throws an actionable error for non-JSON API responses", async () => {
    await expect(
      readApiResponse(
        new Response("<!doctype html>", {
          status: 500,
          headers: { "content-type": "text/html" }
        })
      )
    ).rejects.toThrow(
      "API request failed with HTTP 500 and returned invalid JSON (text/html)."
    );
  });
});

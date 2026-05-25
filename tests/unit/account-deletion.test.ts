import { describe, expect, it } from "vitest";

import { accountStoragePathsFromDocuments } from "@/lib/firestore/account-deletion";

describe("account deletion helpers", () => {
  it("collects unique user storage paths from artwork and export documents", () => {
    expect(
      accountStoragePathsFromDocuments([
        {
          sourceStoragePath: "sources/user-1/project-1/art-1/source.png",
          previewStoragePath: "sources/user-1/project-1/art-1/source.png"
        },
        {
          artifacts: [
            { storagePath: "exports/user-1/project-1/job-1/pack-1.zip" },
            { storagePath: "exports/user-1/project-1/job-1/pack-2.zip" },
            { storagePath: 42 }
          ]
        }
      ])
    ).toEqual([
      "sources/user-1/project-1/art-1/source.png",
      "exports/user-1/project-1/job-1/pack-1.zip",
      "exports/user-1/project-1/job-1/pack-2.zip"
    ]);
  });
});

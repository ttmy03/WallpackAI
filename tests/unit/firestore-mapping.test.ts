import { describe, expect, it } from "vitest";

import {
  assertFirestoreDocumentId,
  generationJobDocumentPath,
  projectDocumentPath,
  userDocumentPath
} from "@/lib/firestore/collections";
import { firestoreGenerationJobFromDocument } from "@/lib/firestore/generation-jobs";
import { firestoreProjectFromDocument } from "@/lib/firestore/projects";
import { firestoreUserFromDocument } from "@/lib/firestore/users";
import type { PromptInput } from "@/lib/prompts/schema";

const promptInputs: PromptInput = {
  packName: "Mountain calm set",
  subject: "minimalist mountain landscape",
  niche: "neutral printable art",
  room: "living room",
  stylePresetKey: "japandi_minimal",
  paletteKey: "warm_neutral_sage",
  mood: "calm and serene",
  composition: "centered with large negative space",
  avoid: ["text", "logos"],
  primaryRatio: "2x3"
};

describe("Firestore persistence helpers", () => {
  it("builds stable top-level document paths", () => {
    expect(userDocumentPath("firebase-user-1")).toBe("users/firebase-user-1");
    expect(projectDocumentPath("prj_123")).toBe("projects/prj_123");
    expect(generationJobDocumentPath("gen_123")).toBe("generationJobs/gen_123");
  });

  it("rejects path-like document ids", () => {
    expect(() => assertFirestoreDocumentId("users/a", "id")).toThrow(
      /Firestore document id/
    );
  });

  it("maps Firestore project documents into project cards safely", () => {
    const project = firestoreProjectFromDocument("prj_123", {
      userId: "firebase-user-1",
      name: "Mountain calm set",
      status: "ready",
      promptInputs,
      stylePresetKey: "japandi_minimal",
      paletteKey: "warm_neutral_sage",
      createdAt: "2026-05-24T19:00:00.000Z",
      updatedAt: "2026-05-24T19:05:00.000Z"
    });

    expect(project.id).toBe("prj_123");
    expect(project.userId).toBe("firebase-user-1");
    expect(project.status).toBe("ready");
    expect(project.promptInputs.subject).toBe("minimalist mountain landscape");
  });

  it("maps Firestore generation jobs without image bytes", () => {
    const job = firestoreGenerationJobFromDocument("gen_123", {
      projectId: "prj_123",
      projectName: "Mountain calm set",
      status: "succeeded",
      requestedCount: 2,
      creditCost: 2,
      creditReserved: true,
      creditCommitted: true,
      prompt: "printable wall art",
      negativePrompt: "No text",
      primaryRatio: "2x3",
      quality: "draft",
      createdAt: "2026-05-24T19:00:00.000Z"
    });

    expect(job.jobId).toBe("gen_123");
    expect(job.status).toBe("succeeded");
    expect(job.artworks).toEqual([]);
  });

  it("maps Firestore user settings with AI disclosure enabled by default", () => {
    const user = firestoreUserFromDocument("firebase-user-1", {
      email: "seller@example.com",
      name: "Seller",
      signInProvider: "google.com",
      emailVerified: true
    });

    expect(user.id).toBe("firebase-user-1");
    expect(user.defaultAiDisclosure).toBe(true);
  });

  it("maps Firestore user settings when AI disclosure is disabled", () => {
    const user = firestoreUserFromDocument("firebase-user-1", {
      defaultAiDisclosure: false
    });

    expect(user.defaultAiDisclosure).toBe(false);
  });
});

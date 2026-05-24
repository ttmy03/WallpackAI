import { randomUUID } from "node:crypto";

import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  FIRESTORE_COLLECTIONS,
  projectDocumentPath
} from "@/lib/firestore/collections";
import type { PromptInput } from "@/lib/prompts/schema";

export type FirestoreProject = {
  id: string;
  userId: string;
  name: string;
  status: "draft" | "generating" | "ready" | "failed";
  niche: string | null;
  theme: string | null;
  stylePresetKey: string | null;
  paletteKey: string | null;
  customPalette: string | null;
  promptInputs: PromptInput;
  latestGenerationJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectCard = {
  id: string;
  name: string;
  status: FirestoreProject["status"];
  stylePresetKey: string | null;
  updatedAt: string;
};

export async function createFirestoreProject(input: {
  userId: string;
  name: string;
  promptInputs: PromptInput;
}) {
  const db = getFirebaseFirestore();
  const projectId = `prj_${randomUUID()}`;
  const now = new Date().toISOString();
  const project: FirestoreProject = {
    id: projectId,
    userId: input.userId,
    name: input.name,
    status: "draft",
    niche: input.promptInputs.niche ?? null,
    theme: input.promptInputs.subject,
    stylePresetKey: input.promptInputs.stylePresetKey,
    paletteKey: input.promptInputs.paletteKey,
    customPalette: input.promptInputs.customPalette ?? null,
    promptInputs: stripUndefined(input.promptInputs),
    latestGenerationJobId: null,
    createdAt: now,
    updatedAt: now
  };

  await db.doc(projectDocumentPath(projectId)).set(project);
  return project;
}

export async function duplicateFirestoreProject(input: {
  userId: string;
  projectId: string;
}) {
  const project = await getFirestoreProjectForUser(
    input.userId,
    input.projectId
  );

  if (!project) {
    return null;
  }

  return createFirestoreProject({
    userId: input.userId,
    name: `${project.name} copy`,
    promptInputs: project.promptInputs
  });
}

export async function getFirestoreProjectForUser(
  userId: string,
  projectId: string
) {
  const snapshot = await getFirebaseFirestore()
    .doc(projectDocumentPath(projectId))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const project = firestoreProjectFromDocument(
    snapshot.id,
    snapshot.data() ?? {}
  );
  return project.userId === userId ? project : null;
}

export async function listFirestoreProjectsForUser(userId: string) {
  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.projects)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => firestoreProjectFromDocument(doc.id, doc.data()))
    .filter((project) => project.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(projectToCard);
}

export async function markFirestoreProjectGenerating(input: {
  projectId: string;
  userId: string;
  generationJobId: string;
}) {
  const project = await getFirestoreProjectForUser(
    input.userId,
    input.projectId
  );

  if (!project) {
    return;
  }

  await getFirebaseFirestore().doc(projectDocumentPath(input.projectId)).set(
    {
      status: "generating",
      latestGenerationJobId: input.generationJobId,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function markFirestoreProjectGenerated(input: {
  projectId: string;
  userId: string;
  status: "ready" | "failed";
}) {
  await markFirestoreProjectStatus(input);
}

export async function markFirestoreProjectStatus(input: {
  projectId: string;
  userId: string;
  status: FirestoreProject["status"];
}) {
  const project = await getFirestoreProjectForUser(
    input.userId,
    input.projectId
  );

  if (!project) {
    return;
  }

  await getFirebaseFirestore().doc(projectDocumentPath(input.projectId)).set(
    {
      status: input.status,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export function firestoreProjectFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): FirestoreProject {
  const promptInputs = data.promptInputs as PromptInput;

  return {
    id,
    userId: stringOrFallback(data.userId, ""),
    name: stringOrFallback(data.name, "Untitled wall-art pack"),
    status: projectStatusOrFallback(data.status),
    niche: nullableString(data.niche),
    theme: nullableString(data.theme),
    stylePresetKey: nullableString(data.stylePresetKey),
    paletteKey: nullableString(data.paletteKey),
    customPalette: nullableString(data.customPalette),
    promptInputs,
    latestGenerationJobId: nullableString(data.latestGenerationJobId),
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString()),
    updatedAt: stringOrFallback(data.updatedAt, new Date(0).toISOString())
  };
}

function projectToCard(project: FirestoreProject): ProjectCard {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    stylePresetKey: project.stylePresetKey,
    updatedAt: project.updatedAt
  };
}

function projectStatusOrFallback(value: unknown): FirestoreProject["status"] {
  if (
    value === "draft" ||
    value === "generating" ||
    value === "ready" ||
    value === "failed"
  ) {
    return value;
  }

  return "draft";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

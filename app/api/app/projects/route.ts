import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import {
  createFirestoreProject,
  listFirestoreProjectsForUser
} from "@/lib/firestore/projects";
import { createProjectSchema } from "@/lib/validations/project";

export async function GET(request: Request) {
  const auth = await requireAppUser(request, "reading projects");

  if (!auth.ok) {
    return auth.response;
  }

  const projects = await listFirestoreProjectsForUser(auth.firestoreUser.id);

  return NextResponse.json(ok({ projects }));
}

export async function POST(request: Request) {
  const auth = await requireAppUser(request, "creating projects");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json();
  const parsed = createProjectSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Project input is invalid.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  const project = await createFirestoreProject({
    userId: auth.firestoreUser.id,
    name: parsed.data.name,
    promptInputs: parsed.data.promptInputs
  });

  return NextResponse.json(ok({ projectId: project.id }), { status: 201 });
}

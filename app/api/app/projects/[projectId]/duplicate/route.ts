import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { DuplicateProjectResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { duplicateFirestoreProject } from "@/lib/firestore/projects";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAppUser(request, "duplicating projects");

  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await params;
  const project = await duplicateFirestoreProject({
    userId: auth.firestoreUser.id,
    projectId
  });

  if (!project) {
    return NextResponse.json(
      fail("PROJECT_NOT_FOUND", "Project was not found for this account."),
      { status: 404 }
    );
  }

  const data: DuplicateProjectResponse = { projectId: project.id };

  return NextResponse.json(ok(data), { status: 201 });
}

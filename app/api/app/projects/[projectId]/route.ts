import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { ProjectDetail } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import {
  getFirestoreGenerationJobForUser,
  listFirestoreArtworksForProject,
  listFirestoreGenerationJobsForUser
} from "@/lib/firestore/generation-jobs";
import { getFirestoreProjectForUser } from "@/lib/firestore/projects";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAppUser(request, "reading projects");

  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await params;
  const project = await getFirestoreProjectForUser(
    auth.firestoreUser.id,
    projectId
  );

  if (!project) {
    return NextResponse.json(
      fail("PROJECT_NOT_FOUND", "Project was not found for this account."),
      { status: 404 }
    );
  }

  const generationJobs = await listFirestoreGenerationJobsForUser(
    auth.firestoreUser.id,
    { projectId: project.id, limit: 10 }
  );
  const latestJobId = project.latestGenerationJobId ?? generationJobs[0]?.jobId;
  const latestGenerationJob = latestJobId
    ? await getFirestoreGenerationJobForUser(latestJobId, auth.firestoreUser.id)
    : null;
  const artworks = await listFirestoreArtworksForProject(
    auth.firestoreUser.id,
    project.id
  );
  const data: ProjectDetail = {
    project,
    generationJobs,
    latestGenerationJob,
    artworks
  };

  return NextResponse.json(ok(data));
}

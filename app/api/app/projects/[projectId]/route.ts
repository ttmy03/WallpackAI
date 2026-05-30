import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { ProjectDetail } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { getUserPlanStatus } from "@/lib/billing/plan-usage";
import { listFirestoreExportJobsForUser } from "@/lib/firestore/export-jobs";
import {
  getLatestFirestoreMockupPackJobForUser,
  listFirestoreMockupJobsForUser
} from "@/lib/firestore/mockup-jobs";
import {
  getFirestoreGenerationJobForUser,
  listFirestoreArtworksForProject,
  listFirestoreGenerationJobsForUser
} from "@/lib/firestore/generation-jobs";
import {
  deleteFirestoreProjectForUser,
  getFirestoreProjectForUser
} from "@/lib/firestore/projects";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
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
    const latestJobId =
      project.latestGenerationJobId ?? generationJobs[0]?.jobId;
    const latestGenerationJob = latestJobId
      ? await getFirestoreGenerationJobForUser(
          latestJobId,
          auth.firestoreUser.id
        )
      : null;
    const artworks = await listFirestoreArtworksForProject(
      auth.firestoreUser.id,
      project.id
    );
    const exportJobs = await listFirestoreExportJobsForUser(
      auth.firestoreUser.id,
      { projectId: project.id, limit: 5 }
    );
    const mockupJobs = await listFirestoreMockupJobsForUser(
      auth.firestoreUser.id,
      {
        projectId: project.id,
        limit: 5,
        includeSignedDownloadUrls: false
      }
    );
    const latestMockupPackJob = await getLatestFirestoreMockupPackJobForUser(
      auth.firestoreUser.id,
      { projectId: project.id, includeSignedDownloadUrls: false }
    );
    const data: ProjectDetail = {
      plan: await getUserPlanStatus(auth.firestoreUser),
      project,
      generationJobs,
      latestGenerationJob,
      exportJobs,
      latestExportJob: exportJobs[0] ?? null,
      mockupJobs,
      latestMockupJob: mockupJobs[0] ?? null,
      latestMockupPackJob,
      artworks
    };

    return NextResponse.json(ok(data));
  } catch (error) {
    console.error("Project detail API failed", error);

    return NextResponse.json(
      fail(
        "PROJECT_LOAD_FAILED",
        "Project data could not be loaded. Check the local dev server logs for details."
      ),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAppUser(request, "deleting projects");

  if (!auth.ok) {
    return auth.response;
  }

  const { projectId } = await params;
  const deleted = await deleteFirestoreProjectForUser({
    userId: auth.firestoreUser.id,
    projectId
  });

  if (!deleted) {
    return NextResponse.json(
      fail("PROJECT_NOT_FOUND", "Project was not found for this account."),
      { status: 404 }
    );
  }

  return NextResponse.json(ok({ projectId, deleted: true }));
}

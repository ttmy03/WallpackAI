import { NextResponse } from "next/server";

import { fail } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { downloadLocalMockupArtifactForUser } from "@/lib/jobs/local-mockup-runner";

export async function GET(
  request: Request,
  {
    params
  }: { params: Promise<{ jobId: string; artifactId: string }> }
) {
  const auth = await requireAppUser(request, "downloading mockup files");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId, artifactId } = await params;
  const artifact = await downloadLocalMockupArtifactForUser({
    jobId,
    artifactId,
    userId: auth.firestoreUser.id
  });

  if (!artifact) {
    return NextResponse.json(
      fail("MOCKUP_ARTIFACT_NOT_FOUND", "Mockup file was not found."),
      { status: 404 }
    );
  }

  return new Response(new Uint8Array(artifact.bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDispositionAttachment(artifact.fileName),
      "Content-Length": artifact.bytes.byteLength.toString(),
      "Content-Type": artifact.contentType
    }
  });
}

function contentDispositionAttachment(fileName: string) {
  const fallback = fileName.replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(fileName);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

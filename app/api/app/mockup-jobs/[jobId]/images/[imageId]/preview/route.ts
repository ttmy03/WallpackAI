import { NextResponse } from "next/server";

import { fail } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { downloadLocalMockupImageForUser } from "@/lib/jobs/local-mockup-runner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string; imageId: string }> }
) {
  const auth = await requireAppUser(request, "previewing mockup files");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId, imageId } = await params;
  const image = await downloadLocalMockupImageForUser({
    jobId,
    imageId,
    userId: auth.firestoreUser.id
  });

  if (!image) {
    return NextResponse.json(
      fail("MOCKUP_IMAGE_NOT_FOUND", "Mockup preview was not found."),
      { status: 404 }
    );
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDispositionInline(image.fileName),
      "Content-Length": image.bytes.byteLength.toString(),
      "Content-Type": image.contentType
    }
  });
}

function contentDispositionInline(fileName: string) {
  const fallback = fileName.replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(fileName);

  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

import { ProjectEditorClient } from "@/components/app/project-editor-client";

export default async function ProjectEditorPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProjectEditorClient projectId={id} />;
}

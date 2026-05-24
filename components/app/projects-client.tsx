"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
import {
  formatAppDate,
  projectStatusVariant
} from "@/components/app/status-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectCard } from "@/lib/firestore/projects";
import { STYLE_PRESETS } from "@/lib/prompts/presets";

type ProjectsResponse = {
  projects: ProjectCard[];
};

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const payload =
          await fetchAuthenticatedApi<ProjectsResponse>("/api/app/projects");

        if (!cancelled) {
          setProjects(payload.projects);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Projects could not be loaded."
          );
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <AppErrorState
        title="Projects could not be loaded"
        message={error}
        actionHref="/app/new"
        actionLabel="New pack"
      />
    );
  }

  if (!projects) {
    return <AppLoadingState label="Loading projects..." />;
  }

  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Wall-art packs
          </h1>
        </div>
        <Button asChild>
          <Link href="/app/new">New pack</Link>
        </Button>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border bg-card">
        {projects.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Style</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/projects/${project.id}/editor`}
                      className="font-medium text-primary hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {styleLabel(project.stylePresetKey)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={projectStatusVariant(project.status)}>
                      {project.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatAppDate(project.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6">
            <p className="font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated packs will appear here after the first preview job.
            </p>
            <Button asChild className="mt-4">
              <Link href="/app/new">Create first pack</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function styleLabel(stylePresetKey: string | null) {
  if (!stylePresetKey) {
    return "Not set";
  }

  return (
    STYLE_PRESETS[stylePresetKey as keyof typeof STYLE_PRESETS]?.label ??
    stylePresetKey
  );
}

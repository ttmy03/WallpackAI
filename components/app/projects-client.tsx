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
    <main className="min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Wall-art packs
          </h1>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/app/new">New pack</Link>
        </Button>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border bg-card">
        {projects.length > 0 ? (
          <>
            <div className="divide-y md:hidden">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.id}/editor`}
                  className="block p-4 transition hover:bg-secondary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium text-primary">
                      {project.name}
                    </p>
                    <Badge
                      variant={projectStatusVariant(project.status)}
                      className="shrink-0"
                    >
                      {project.status}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>
                      <dt className="font-medium text-foreground">Style</dt>
                      <dd className="mt-0.5 break-words">
                        {styleLabel(project.stylePresetKey)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Updated</dt>
                      <dd className="mt-0.5">
                        {formatAppDate(project.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>

            <table className="hidden w-full text-left text-sm md:table">
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
          </>
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

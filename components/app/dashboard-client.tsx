"use client";

import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Copy,
  Download,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import {
  formatAppDate,
  generationStatusVariant,
  projectStatusVariant
} from "@/components/app/status-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/app/api-types";

export function DashboardClient() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const dashboard =
          await fetchAuthenticatedApi<DashboardSummary>("/api/app/dashboard");

        if (!cancelled) {
          setData(dashboard);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Dashboard could not be loaded."
          );
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <AppErrorState
        title="Dashboard could not be loaded"
        message={error}
        actionHref="/app/new"
        actionLabel="Create a new pack"
      />
    );
  }

  if (!data) {
    return <AppLoadingState label="Loading dashboard..." />;
  }

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Etsy wall-art workspace
          </h1>
        </div>
        <Button asChild>
          <Link href="/app/new">
            New Wall Art Pack <ArrowRight />
          </Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Plan</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {data.plan.label} <Sparkles className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.plan.previewBatches.limit === null
              ? `${data.creditBalance} credits available for preview and export jobs.`
              : `${data.plan.previewBatches.remaining} of ${data.plan.previewBatches.limit} free preview batches left.`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Recent exports</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {data.recentExportsCount}{" "}
              <Download className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Completed Etsy pack exports with downloadable ZIP files.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Jobs needing action</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {data.jobsNeedingAction}{" "}
              <AlertCircle className="size-5 text-accent" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Failed or cancelled jobs can be opened from their project.
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <CardDescription>
              Your latest Firestore-backed wall-art packs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.recentProjects.length > 0 ? (
              data.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.id}/editor`}
                  className="grid gap-3 rounded-md border p-4 transition hover:bg-secondary sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Updated {formatAppDate(project.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={projectStatusVariant(project.status)}>
                    {project.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No projects yet"
                message="Create a pack to see real project data here."
                actionHref="/app/new"
                actionLabel="New pack"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generation jobs</CardTitle>
            <CardDescription>
              Recent preview jobs from Firestore.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.recentGenerationJobs.length > 0 ? (
              data.recentGenerationJobs.map((job) => (
                <Link
                  key={job.jobId}
                  href={`/app/projects/${job.projectId}/editor`}
                  className="rounded-md border p-4 transition hover:bg-secondary"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{job.projectName}</p>
                    <Badge variant={generationStatusVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4" />
                    {job.stage ?? "queued"} · {formatAppDate(job.createdAt)}
                  </p>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No generation jobs"
                message="Preview jobs will appear after you generate artwork."
                actionHref="/app/new"
                actionLabel="Generate previews"
              />
            )}
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/projects">
                <Copy />
                View all projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function AppLoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function AppErrorState({
  title,
  message,
  actionHref,
  actionLabel
}: {
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  message,
  actionHref,
  actionLabel
}: {
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-md border border-dashed p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

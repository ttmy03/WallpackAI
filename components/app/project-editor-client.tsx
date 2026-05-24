"use client";

import { Copy, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
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
import type {
  DuplicateProjectResponse,
  ProjectDetail,
  RetryGenerationResponse
} from "@/lib/app/api-types";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  DEFAULT_PRINT_RATIO_KEYS,
  PRINT_RATIO_PRESETS
} from "@/lib/print/presets";

type ActionState = {
  message: string | null;
  error: string | null;
  pending: "retry" | "cancel" | "duplicate" | null;
};

export function ProjectEditorClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    null
  );
  const [action, setAction] = useState<ActionState>({
    message: null,
    error: null,
    pending: null
  });

  const loadProject = useCallback(async () => {
    const projectDetail = await fetchAuthenticatedApi<ProjectDetail>(
      `/api/app/projects/${projectId}`
    );

    setDetail(projectDetail);
    setSelectedArtworkId(
      (current) => current ?? projectDetail.artworks[0]?.artworkId ?? null
    );
    setLoadError(null);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const projectDetail = await fetchAuthenticatedApi<ProjectDetail>(
          `/api/app/projects/${projectId}`
        );

        if (!cancelled) {
          setDetail(projectDetail);
          setSelectedArtworkId(projectDetail.artworks[0]?.artworkId ?? null);
          setLoadError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setLoadError(
            caughtError instanceof Error
              ? caughtError.message
              : "Project could not be loaded."
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedArtwork = useMemo(
    () =>
      detail?.artworks.find(
        (artwork) => artwork.artworkId === selectedArtworkId
      ) ??
      detail?.artworks[0] ??
      null,
    [detail?.artworks, selectedArtworkId]
  );
  const selectedArtworkSrc =
    selectedArtwork?.dataUrl ?? selectedArtwork?.previewUrl ?? null;

  async function runAction(
    pending: ActionState["pending"],
    successMessage: string,
    callback: () => Promise<void>
  ) {
    setAction({ message: null, error: null, pending });

    try {
      await callback();
      setAction({ message: successMessage, error: null, pending: null });
    } catch (caughtError) {
      setAction({
        message: null,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Action could not be completed.",
        pending: null
      });
    }
  }

  const latestJob =
    detail?.latestGenerationJob ?? detail?.generationJobs[0] ?? null;
  const canRetry = latestJob?.status === "failed" && latestJob.retryable;
  const canCancel =
    latestJob?.status === "queued" || latestJob?.status === "validating";

  if (loadError) {
    return (
      <AppErrorState
        title="Project could not be loaded"
        message={loadError}
        actionHref="/app/projects"
        actionLabel="Back to projects"
      />
    );
  }

  if (!detail) {
    return <AppLoadingState label="Loading project..." />;
  }

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Project editor
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal">
              {detail.project.name}
            </h1>
            <Badge variant={projectStatusVariant(detail.project.status)}>
              {detail.project.status}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!canRetry || action.pending !== null}
            onClick={() =>
              latestJob
                ? void runAction("retry", "Retry queued.", async () => {
                    await fetchAuthenticatedApi<RetryGenerationResponse>(
                      `/api/app/generation-jobs/${latestJob.jobId}/retry`,
                      { method: "POST" }
                    );
                    await loadProject();
                  })
                : undefined
            }
          >
            {action.pending === "retry" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
            Retry
          </Button>
          <Button
            variant="outline"
            disabled={!canCancel || action.pending !== null}
            onClick={() =>
              latestJob
                ? void runAction(
                    "cancel",
                    "Generation cancelled.",
                    async () => {
                      await fetchAuthenticatedApi(
                        `/api/app/generation-jobs/${latestJob.jobId}/cancel`,
                        { method: "POST" }
                      );
                      await loadProject();
                    }
                  )
                : undefined
            }
          >
            <XCircle />
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={action.pending !== null}
            onClick={() =>
              void runAction("duplicate", "Project duplicated.", async () => {
                const duplicated =
                  await fetchAuthenticatedApi<DuplicateProjectResponse>(
                    `/api/app/projects/${detail.project.id}/duplicate`,
                    { method: "POST" }
                  );
                router.push(`/app/projects/${duplicated.projectId}/editor`);
              })
            }
          >
            {action.pending === "duplicate" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Copy />
            )}
            Duplicate
          </Button>
          <Button disabled title="Export backend is not connected yet.">
            <Sparkles />
            Create Etsy Pack
          </Button>
        </div>
      </div>

      {action.message ? (
        <div className="mt-6 rounded-md border bg-secondary px-4 py-3 text-sm">
          {action.message}
        </div>
      ) : null}
      {action.error ? (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {action.error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Artwork</CardTitle>
            <CardDescription>Generated previews</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {detail.artworks.length > 0 ? (
              detail.artworks.map((artwork) => (
                <ArtworkButton
                  key={artwork.artworkId}
                  artwork={artwork}
                  selected={selectedArtwork?.artworkId === artwork.artworkId}
                  onSelect={() => setSelectedArtworkId(artwork.artworkId)}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No generated artwork yet.
              </div>
            )}
          </CardContent>
        </Card>

        <section className="min-w-0 rounded-lg border bg-card p-4">
          {selectedArtwork && selectedArtworkSrc ? (
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-secondary">
                <Image
                  src={selectedArtworkSrc}
                  alt="Selected generated wall-art preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg" />
                <div className="absolute bottom-4 left-4 rounded-md bg-black/50 px-3 py-2 text-sm text-white backdrop-blur">
                  Focal point centered
                </div>
              </div>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                Source preview: {selectedArtwork.width} x{" "}
                {selectedArtwork.height} px. Crop settings are not persisted
                yet.
              </figcaption>
            </figure>
          ) : selectedArtwork ? (
            <div className="grid aspect-[4/5] place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
              Preview URL is unavailable.
            </div>
          ) : (
            <div className="grid aspect-[4/5] place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
              Generate previews to start editing this project.
            </div>
          )}

          {latestJob ? (
            <div className="mt-4 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Latest generation job</p>
                <Badge variant={generationStatusVariant(latestJob.status)}>
                  {latestJob.status}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                {latestJob.stage ?? "queued"} · {latestJob.creditCost} credits ·{" "}
                {formatAppDate(latestJob.createdAt)}
              </p>
              {latestJob.errorMessage ? (
                <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                  {latestJob.errorMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Ratio previews</CardTitle>
            <CardDescription>
              Exact target dimensions before export
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {DEFAULT_PRINT_RATIO_KEYS.map((key) => {
              const preset = PRINT_RATIO_PRESETS[key];
              const pixels = presetKeyToPixels(key);

              return (
                <div key={key} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{preset.label}</p>
                    <Badge variant="secondary">{key}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {preset.masterPrintWidthIn} x {preset.masterPrintHeightIn}{" "}
                    in @ 300 DPI
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {pixels.width} x {pixels.height} px
                  </p>
                </div>
              );
            })}
            <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
              <div className="flex gap-2">
                <XCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>File-size estimates require the export backend.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ArtworkButton({
  artwork,
  selected,
  onSelect
}: {
  artwork: GeneratedArtworkPreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const src = artwork.dataUrl ?? artwork.previewUrl;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-md border bg-secondary text-left transition hover:ring-2 hover:ring-ring ${
        selected ? "ring-2 ring-ring" : ""
      }`}
      aria-label={`Select artwork ${artwork.artworkId}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={artwork.width}
          height={artwork.height}
          unoptimized
          className="aspect-[4/5] w-full object-cover"
        />
      ) : (
        <span className="grid aspect-[4/5] place-items-center text-xs text-muted-foreground">
          Preview unavailable
        </span>
      )}
      <span className="block border-t px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {artwork.width} x {artwork.height}
      </span>
    </button>
  );
}

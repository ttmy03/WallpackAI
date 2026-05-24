"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle
} from "lucide-react";
import Image from "next/image";
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
  ProjectDetail,
  RetryGenerationResponse
} from "@/lib/app/api-types";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import { presetKeyToPixels, upscaleWarning } from "@/lib/print/math";
import {
  DEFAULT_PRINT_RATIO_KEYS,
  getDefaultPrintRatioKeys,
  getPrintRatioOrientation,
  PRINT_RATIO_PRESETS,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

type ActionState = {
  message: string | null;
  error: string | null;
  pending: "retry" | "cancel" | null;
};

export function ProjectEditorClient({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    null
  );
  const [selectedRatioKey, setSelectedRatioKey] =
    useState<PrintRatioPresetKey>(DEFAULT_PRINT_RATIO_KEYS[0]);
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
    setSelectedRatioKey((current) => {
      const ratioKeys = getProjectRatioKeys(projectDetail);
      return ratioKeys.includes(current) ? current : ratioKeys[0];
    });
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
          setSelectedRatioKey((current) => {
            const ratioKeys = getProjectRatioKeys(projectDetail);
            return ratioKeys.includes(current) ? current : ratioKeys[0];
          });
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
  const projectRatioKeys = detail
    ? getProjectRatioKeys(detail)
    : DEFAULT_PRINT_RATIO_KEYS;
  const selectedRatioPreset = PRINT_RATIO_PRESETS[selectedRatioKey];
  const selectedRatioPixels = useMemo(
    () => presetKeyToPixels(selectedRatioKey),
    [selectedRatioKey]
  );
  const selectedRatioAssessment = selectedArtwork
    ? getResizeAssessment(
        { width: selectedArtwork.width, height: selectedArtwork.height },
        selectedRatioPixels
      )
    : null;

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
              <div
                className="relative mx-auto max-h-[720px] w-full overflow-hidden rounded-md bg-secondary"
                style={{
                  aspectRatio: `${selectedRatioPreset.ratioWidth} / ${selectedRatioPreset.ratioHeight}`
                }}
              >
                <Image
                  src={selectedArtworkSrc}
                  alt="Selected generated wall-art preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg" />
                <div className="absolute bottom-4 left-4 rounded-md bg-black/50 px-3 py-2 text-sm text-white backdrop-blur">
                  {selectedRatioPreset.label} · {selectedRatioPixels.width} x{" "}
                  {selectedRatioPixels.height} px
                </div>
              </div>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                Source preview: {selectedArtwork.width} x{" "}
                {selectedArtwork.height} px. Export preview:{" "}
                {selectedRatioPreset.masterPrintWidthIn} x{" "}
                {selectedRatioPreset.masterPrintHeightIn} in @{" "}
                {selectedRatioPreset.targetDpi} DPI.
              </figcaption>
            </figure>
          ) : selectedArtwork ? (
            <div
              className="grid place-items-center rounded-md border border-dashed text-sm text-muted-foreground"
              style={{
                aspectRatio: `${selectedRatioPreset.ratioWidth} / ${selectedRatioPreset.ratioHeight}`
              }}
            >
              Preview URL is unavailable.
            </div>
          ) : (
            <div
              className="grid place-items-center rounded-md border border-dashed text-sm text-muted-foreground"
              style={{
                aspectRatio: `${selectedRatioPreset.ratioWidth} / ${selectedRatioPreset.ratioHeight}`
              }}
            >
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
            <div className="rounded-md border bg-secondary/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{selectedRatioPreset.label}</p>
                <Badge variant="secondary">{selectedRatioKey}</Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Print Size</dt>
                  <dd>
                    {formatInches(selectedRatioPreset.masterPrintWidthIn)} x{" "}
                    {formatInches(selectedRatioPreset.masterPrintHeightIn)} in @{" "}
                    {selectedRatioPreset.targetDpi} DPI
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Target file</dt>
                  <dd className="font-mono">
                    {selectedRatioPixels.width} x {selectedRatioPixels.height} px
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Filename</dt>
                  <dd className="break-all font-mono text-xs">
                    {selectedRatioPreset.fileName}
                  </dd>
                </div>
              </dl>
              {selectedRatioAssessment ? (
                <div
                  className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                    selectedRatioAssessment.status === "pass"
                      ? "border-primary/30 bg-primary/10"
                      : "border-accent/40 bg-accent/10"
                  }`}
                >
                  <div className="flex gap-2">
                    {selectedRatioAssessment.status === "pass" ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
                    )}
                    <p>
                      {selectedRatioAssessment.message} Resize factor:{" "}
                      {selectedRatioAssessment.factor.toFixed(2)}x.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            {projectRatioKeys.map((key) => {
              const preset = PRINT_RATIO_PRESETS[key];
              const pixels = presetKeyToPixels(key);

              return (
                <RatioPreviewButton
                  key={key}
                  presetKey={key}
                  label={preset.label}
                  printSize={`${formatInches(preset.masterPrintWidthIn)} x ${formatInches(
                    preset.masterPrintHeightIn
                  )} in @ ${preset.targetDpi} DPI`}
                  pixels={`${pixels.width} x ${pixels.height} px`}
                  selected={selectedRatioKey === key}
                  onSelect={() => setSelectedRatioKey(key)}
                />
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

function RatioPreviewButton({
  presetKey,
  label,
  printSize,
  pixels,
  selected,
  onSelect
}: {
  presetKey: PrintRatioPresetKey;
  label: string;
  printSize: string;
  pixels: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-md border p-4 text-left transition hover:border-primary hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-primary bg-primary/10 ring-2 ring-primary/25" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <Badge variant={selected ? "default" : "secondary"}>{presetKey}</Badge>
      </span>
      <span className="mt-2 block text-sm text-muted-foreground">
        {printSize}
      </span>
      <span className="mt-1 block font-mono text-sm">{pixels}</span>
    </button>
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
          className="w-full object-cover"
          style={{
            aspectRatio: `${artwork.width} / ${artwork.height}`
          }}
        />
      ) : (
        <span
          className="grid place-items-center text-xs text-muted-foreground"
          style={{
            aspectRatio: `${artwork.width} / ${artwork.height}`
          }}
        >
          Preview unavailable
        </span>
      )}
      <span className="block border-t px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {artwork.width} x {artwork.height}
      </span>
    </button>
  );
}

function getResizeAssessment(
  sourcePixels: { width: number; height: number },
  targetPixels: { width: number; height: number }
) {
  const status = upscaleWarning(sourcePixels, targetPixels);
  const factor =
    Math.max(targetPixels.width, targetPixels.height) /
    Math.max(sourcePixels.width, sourcePixels.height);

  if (status === "strong_warning") {
    return {
      status,
      factor,
      message: "Strong upscale needed. Large prints may lose detail."
    };
  }

  if (status === "warning") {
    return {
      status,
      factor,
      message: "Moderate upscale needed. Review detail before export."
    };
  }

  return {
    status,
    factor,
    message: "Source is within a normal resize range."
  };
}

function getProjectRatioKeys(detail: ProjectDetail) {
  return getDefaultPrintRatioKeys(
    getPrintRatioOrientation(detail.project.promptInputs.primaryRatio)
  );
}

function formatInches(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

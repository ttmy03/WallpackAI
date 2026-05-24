"use client";

import {
  Check,
  CreditCard,
  Download,
  Loader2,
  Sparkles,
  X,
  XCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
import {
  exportStatusVariant,
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
import type { ExportJobResponse, ProjectDetail } from "@/lib/app/api-types";
import type { ExportJobView } from "@/lib/jobs/export-types";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import { presetKeyToPixels } from "@/lib/print/math";
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
  pending: "delete" | "export" | null;
};

const TERMINAL_EXPORT_STATUSES = new Set<ExportJobView["status"]>([
  "succeeded",
  "failed",
  "cancelled"
]);

export function ProjectEditorClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    null
  );
  const [selectedRatioKey, setSelectedRatioKey] = useState<PrintRatioPresetKey>(
    DEFAULT_PRINT_RATIO_KEYS[0]
  );
  const [action, setAction] = useState<ActionState>({
    message: null,
    error: null,
    pending: null
  });
  const [activeExportJobId, setActiveExportJobId] = useState<string | null>(
    null
  );
  const [showExportUpsell, setShowExportUpsell] = useState(false);

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

  useEffect(() => {
    const jobId =
      activeExportJobId ??
      (detail?.latestExportJob &&
      !TERMINAL_EXPORT_STATUSES.has(detail.latestExportJob.status)
        ? detail.latestExportJob.jobId
        : null);

    if (!jobId) {
      return;
    }

    let cancelled = false;

    async function pollExportJob() {
      try {
        const job = await fetchAuthenticatedApi<ExportJobView>(
          `/api/app/export-jobs/${jobId}`
        );

        if (cancelled) {
          return;
        }

        setDetail((current) => mergeExportJob(current, job));

        if (TERMINAL_EXPORT_STATUSES.has(job.status)) {
          setActiveExportJobId(null);
          await loadProject();
        }
      } catch (caughtError) {
        if (!cancelled) {
          setAction({
            message: null,
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Export status could not be refreshed.",
            pending: null
          });
        }
      }
    }

    void pollExportJob();
    const interval = window.setInterval(() => {
      void pollExportJob();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeExportJobId, detail?.latestExportJob, loadProject]);

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

  async function startExport() {
    if (!detail || !selectedArtwork) {
      return;
    }

    if (!detail.plan.canExportEtsyPack) {
      setShowExportUpsell(true);
      return;
    }

    await runAction("export", "Export job queued.", async () => {
      const result = await fetchAuthenticatedApi<ExportJobResponse>(
        `/api/app/projects/${projectId}/exports`,
        {
          method: "POST",
          body: JSON.stringify({
            artworkId: selectedArtwork.artworkId,
            ratioKeys: projectRatioKeys
          })
        }
      );
      setActiveExportJobId(result.jobId);
      await loadProject();
    });
  }

  async function deleteProject() {
    const confirmed = window.confirm(
      "Delete this project and its generated files? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    await runAction("delete", "Project deleted.", async () => {
      await fetchAuthenticatedApi(`/api/app/projects/${projectId}`, {
        method: "DELETE"
      });
      router.push("/app/projects");
      router.refresh();
    });
  }

  const latestJob =
    detail?.latestGenerationJob ?? detail?.generationJobs[0] ?? null;
  const latestExportJob =
    detail?.latestExportJob ?? detail?.exportJobs[0] ?? null;
  const exportRunning =
    latestExportJob && !TERMINAL_EXPORT_STATUSES.has(latestExportJob.status);
  const canCreateExport =
    Boolean(selectedArtwork) && !exportRunning && action.pending === null;

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
            <Badge
              variant={detail.plan.planKey === "free" ? "secondary" : "default"}
            >
              {detail.plan.label} plan
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            disabled={action.pending !== null}
            onClick={() => void deleteProject()}
            title="Delete this project and return to the project list."
          >
            {action.pending === "delete" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <XCircle />
            )}
            Cancel Project
          </Button>
          <Button
            disabled={!canCreateExport}
            onClick={() => void startExport()}
            title={
              !selectedArtwork
                ? "Generate and select artwork before exporting."
                : detail.plan.canExportEtsyPack
                  ? "Create Etsy upload ZIP files for the selected artwork."
                  : "Open upgrade options for Etsy pack exports."
            }
          >
            {action.pending === "export" || exportRunning ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
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
      <ExportUpsellDialog
        open={showExportUpsell}
        onClose={() => setShowExportUpsell(false)}
      />

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

          {latestExportJob ? <ExportJobPanel job={latestExportJob} /> : null}
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
                    {selectedRatioPixels.width} x {selectedRatioPixels.height}{" "}
                    px
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Filename</dt>
                  <dd className="break-all font-mono text-xs">
                    {selectedRatioPreset.fileName}
                  </dd>
                </div>
              </dl>
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
            {latestExportJob?.files.length ? (
              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium">Last export files</p>
                <div className="mt-3 grid gap-2">
                  {latestExportJob.files.map((file) => (
                    <div
                      key={file.fileName}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-mono text-xs">{file.fileName}</span>
                      <span className="text-muted-foreground">
                        {formatBytes(file.bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
                <div className="flex gap-2">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                  <p>Create an Etsy pack to calculate real file sizes.</p>
                </div>
              </div>
            )}
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

function ExportJobPanel({ job }: { job: ExportJobView }) {
  const running = !TERMINAL_EXPORT_STATUSES.has(job.status);

  return (
    <div className="mt-4 rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Latest export job</p>
          <p className="mt-1 text-muted-foreground">
            {job.stage ?? "queued"} · {job.creditCost} credits ·{" "}
            {formatAppDate(job.createdAt)}
          </p>
        </div>
        <Badge variant={exportStatusVariant(job.status)}>{job.status}</Badge>
      </div>

      {running ? (
        <div className="mt-4 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Creating print files and Etsy ZIPs.
        </div>
      ) : null}

      {job.errorMessage ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          {job.errorMessage}
        </p>
      ) : null}

      {job.warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2">
          {job.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {job.artifacts.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {job.artifacts.map((artifact) => (
            <Button
              key={artifact.artifactId}
              asChild
              variant="outline"
              size="sm"
              className="justify-between"
            >
              <a href={artifact.downloadUrl} target="_blank" rel="noreferrer">
                <span className="truncate">{artifact.fileName}</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  {formatBytes(artifact.bytes)}
                  <Download />
                </span>
              </a>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExportUpsellDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-upsell-title"
        className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary">Free plan</Badge>
            <h2
              id="export-upsell-title"
              className="mt-3 text-2xl font-semibold tracking-normal"
            >
              Upgrade to create Etsy packs
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close upgrade dialog"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Free includes 3 preview batches with 2 previews each. Etsy upload
          ZIPs, exact print files, listing copy, and buyer instructions are
          available on paid plans.
        </p>
        <ul className="mt-5 grid gap-3 text-sm">
          {[
            "5-ratio print-ready JPG files with real pixel dimensions",
            "Etsy upload files planned below the 20 MB hard limit",
            "Listing copy with AI-assisted creation disclosure"
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/pricing">
              <CreditCard />
              View plans
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep editing
          </Button>
        </div>
      </section>
    </div>
  );
}

function getProjectRatioKeys(detail: ProjectDetail) {
  return getDefaultPrintRatioKeys(
    getPrintRatioOrientation(detail.project.promptInputs.primaryRatio)
  );
}

function formatInches(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function mergeExportJob(
  detail: ProjectDetail | null,
  job: ExportJobView
): ProjectDetail | null {
  if (!detail) {
    return detail;
  }

  const exportJobs = [
    job,
    ...detail.exportJobs.filter((candidate) => candidate.jobId !== job.jobId)
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    ...detail,
    exportJobs,
    latestExportJob: exportJobs[0] ?? null
  };
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

"use client";

import {
  Check,
  CreditCard,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  XCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import {
  fetchAuthenticatedApi,
  fetchAuthenticatedBlob
} from "@/components/app/authenticated-api";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
import {
  exportStatusVariant,
  formatAppDate,
  generationStatusVariant,
  mockupStatusVariant,
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
  ExportJobResponse,
  MockupJobResponse,
  ProjectDetail,
  RetryGenerationResponse
} from "@/lib/app/api-types";
import {
  ETSY_PACK_EXPORT_CREDIT_COST,
  GENERATION_PREVIEW_CREDIT_COST,
  MOCKUP_PACK_CREDIT_COST
} from "@/lib/billing/plans";
import type { ExportJobView } from "@/lib/jobs/export-types";
import type {
  GeneratedArtworkDimensionPreview,
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";
import type { MockupJobView } from "@/lib/jobs/mockup-types";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  DEFAULT_AUTOMATIC_PRINT_RATIO_KEYS,
  PRINT_RATIO_PRESETS,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import { cn } from "@/lib/utils";

type ActionState = {
  message: string | null;
  error: string | null;
  pending: "delete" | "export" | "generate" | "mockup" | null;
};

type PreviewFrameStyle = CSSProperties & {
  "--preview-desktop-max-width": string;
  "--preview-ratio-height": string;
  "--preview-ratio-width": string;
};

type QueueGenerationResponse = {
  jobId: string;
  status: GenerationJobView["status"];
  projectId: string;
};

const TERMINAL_EXPORT_STATUSES = new Set<ExportJobView["status"]>([
  "succeeded",
  "failed",
  "cancelled"
]);

const TERMINAL_GENERATION_STATUSES = new Set<GenerationJobView["status"]>([
  "succeeded",
  "failed",
  "cancelled"
]);

const TERMINAL_MOCKUP_STATUSES = new Set<MockupJobView["status"]>([
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
    DEFAULT_AUTOMATIC_PRINT_RATIO_KEYS[0]
  );
  const [action, setAction] = useState<ActionState>({
    message: null,
    error: null,
    pending: null
  });
  const [activeExportJobId, setActiveExportJobId] = useState<string | null>(
    null
  );
  const [activeMockupJobId, setActiveMockupJobId] = useState<string | null>(
    null
  );
  const [activeGenerationJobId, setActiveGenerationJobId] = useState<
    string | null
  >(null);
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

  const latestExportJobId = detail?.latestExportJob?.jobId ?? null;
  const latestExportJobStatus = detail?.latestExportJob?.status ?? null;
  const latestGenerationJobId = detail?.latestGenerationJob?.jobId ?? null;
  const latestGenerationJobStatus = detail?.latestGenerationJob?.status ?? null;
  const latestMockupJobId = detail?.latestMockupJob?.jobId ?? null;
  const latestMockupJobStatus = detail?.latestMockupJob?.status ?? null;

  useEffect(() => {
    const jobId =
      activeExportJobId ??
      (latestExportJobId &&
      latestExportJobStatus &&
      !TERMINAL_EXPORT_STATUSES.has(latestExportJobStatus)
        ? latestExportJobId
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
  }, [
    activeExportJobId,
    latestExportJobId,
    latestExportJobStatus,
    loadProject
  ]);

  useEffect(() => {
    const jobId =
      activeMockupJobId ??
      (latestMockupJobId &&
      latestMockupJobStatus &&
      !TERMINAL_MOCKUP_STATUSES.has(latestMockupJobStatus)
        ? latestMockupJobId
        : null);

    if (!jobId) {
      return;
    }

    let cancelled = false;

    async function pollMockupJob() {
      try {
        const job = await fetchAuthenticatedApi<MockupJobView>(
          `/api/app/mockup-jobs/${jobId}`
        );

        if (cancelled) {
          return;
        }

        setDetail((current) => mergeMockupJob(current, job));

        if (TERMINAL_MOCKUP_STATUSES.has(job.status)) {
          setActiveMockupJobId(null);
          await loadProject();
        }
      } catch (caughtError) {
        if (!cancelled) {
          setAction({
            message: null,
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Mockup status could not be refreshed.",
            pending: null
          });
        }
      }
    }

    void pollMockupJob();
    const interval = window.setInterval(() => {
      void pollMockupJob();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeMockupJobId,
    latestMockupJobId,
    latestMockupJobStatus,
    loadProject
  ]);

  useEffect(() => {
    const jobId =
      activeGenerationJobId ??
      (latestGenerationJobId &&
      latestGenerationJobStatus &&
      !TERMINAL_GENERATION_STATUSES.has(latestGenerationJobStatus)
        ? latestGenerationJobId
        : null);

    if (!jobId) {
      return;
    }

    let cancelled = false;

    async function pollGenerationJob() {
      try {
        const job = await fetchAuthenticatedApi<GenerationJobView>(
          `/api/app/generation-jobs/${jobId}`
        );

        if (cancelled) {
          return;
        }

        setDetail((current) => mergeGenerationJob(current, job));

        if (TERMINAL_GENERATION_STATUSES.has(job.status)) {
          setActiveGenerationJobId(null);
          await loadProject();

          if (job.status === "succeeded" && job.artworks[0]) {
            setSelectedArtworkId(job.artworks[0].artworkId);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setAction({
            message: null,
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Generation status could not be refreshed.",
            pending: null
          });
        }
      }
    }

    void pollGenerationJob();
    const interval = window.setInterval(() => {
      void pollGenerationJob();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeGenerationJobId,
    latestGenerationJobId,
    latestGenerationJobStatus,
    loadProject
  ]);

  const selectedArtwork = useMemo(
    () =>
      detail?.artworks.find(
        (artwork) => artwork.artworkId === selectedArtworkId
      ) ??
      detail?.artworks[0] ??
      null,
    [detail?.artworks, selectedArtworkId]
  );
  const projectRatioKeys = detail
    ? getProjectRatioKeys(detail)
    : DEFAULT_AUTOMATIC_PRINT_RATIO_KEYS;
  const selectedRatioPreset = PRINT_RATIO_PRESETS[selectedRatioKey];
  const selectedRatioPixels = useMemo(
    () => presetKeyToPixels(selectedRatioKey),
    [selectedRatioKey]
  );
  const selectedDimensionPreview = useMemo(
    () =>
      selectedArtwork?.dimensionPreviews?.find(
        (preview) => preview.ratioKey === selectedRatioKey
      ) ?? null,
    [selectedArtwork, selectedRatioKey]
  );
  const selectedArtworkSrc =
    getDimensionPreviewSrc(selectedDimensionPreview) ??
    selectedArtwork?.dataUrl ??
    selectedArtwork?.previewUrl ??
    null;
  const selectedSourceWidth =
    selectedDimensionPreview?.sourceWidth ?? selectedArtwork?.width ?? 0;
  const selectedSourceHeight =
    selectedDimensionPreview?.sourceHeight ?? selectedArtwork?.height ?? 0;
  const selectedPreviewFrameStyle: PreviewFrameStyle = {
    "--preview-desktop-max-width": `${Math.round(
      (720 * selectedRatioPreset.ratioWidth) / selectedRatioPreset.ratioHeight
    )}px`,
    "--preview-ratio-height": selectedRatioPreset.ratioHeight.toString(),
    "--preview-ratio-width": selectedRatioPreset.ratioWidth.toString(),
    aspectRatio: `${selectedRatioPreset.ratioWidth} / ${selectedRatioPreset.ratioHeight}`
  };

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

  async function startMockupPack() {
    if (!detail || !selectedArtwork) {
      return;
    }

    await runAction("mockup", "Mockup pack queued.", async () => {
      const result = await fetchAuthenticatedApi<MockupJobResponse>(
        `/api/app/projects/${projectId}/mockups`,
        {
          method: "POST",
          body: JSON.stringify({
            artworkId: selectedArtwork.artworkId,
            ratioKey: selectedRatioKey
          })
        }
      );
      setActiveMockupJobId(result.jobId);
      await loadProject();
    });
  }

  async function startVariantGeneration() {
    if (!detail) {
      return;
    }

    await runAction(
      "generate",
      "5-ratio variant generation queued.",
      async () => {
        const result = await fetchAuthenticatedApi<QueueGenerationResponse>(
          "/api/app/generations",
          {
            method: "POST",
            body: JSON.stringify({
              projectId,
              promptInputs: detail.project.promptInputs,
              previewCount: 1,
              quality: "draft"
            })
          }
        );
        setActiveGenerationJobId(result.jobId);
        await loadProject();
      }
    );
  }

  async function retryGeneration(jobId: string) {
    await runAction(
      "generate",
      "5-ratio variant generation queued.",
      async () => {
        const result = await fetchAuthenticatedApi<RetryGenerationResponse>(
          `/api/app/generation-jobs/${jobId}/retry`,
          {
            method: "POST"
          }
        );
        setActiveGenerationJobId(result.jobId);
        await loadProject();
      }
    );
  }

  async function retryExport(jobId: string) {
    await runAction("export", "Export job queued.", async () => {
      const result = await fetchAuthenticatedApi<ExportJobResponse>(
        `/api/app/export-jobs/${jobId}/retry`,
        {
          method: "POST"
        }
      );
      setActiveExportJobId(result.jobId);
      await loadProject();
    });
  }

  async function retryMockup(jobId: string) {
    await runAction("mockup", "Mockup pack queued.", async () => {
      const result = await fetchAuthenticatedApi<MockupJobResponse>(
        `/api/app/mockup-jobs/${jobId}/retry`,
        {
          method: "POST"
        }
      );
      setActiveMockupJobId(result.jobId);
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
  const latestMockupJob =
    detail?.latestMockupJob ?? detail?.mockupJobs[0] ?? null;
  const latestMockupPackJob = detail
    ? findLatestMockupPackJob([
        ...detail.mockupJobs,
        ...(detail.latestMockupPackJob ? [detail.latestMockupPackJob] : [])
      ])
    : null;
  const generationRunning = Boolean(
    latestJob && !TERMINAL_GENERATION_STATUSES.has(latestJob.status)
  );
  const exportRunning = Boolean(
    latestExportJob && !TERMINAL_EXPORT_STATUSES.has(latestExportJob.status)
  );
  const mockupRunning = Boolean(
    latestMockupJob && !TERMINAL_MOCKUP_STATUSES.has(latestMockupJob.status)
  );
  const canGenerateVariant =
    Boolean(detail) &&
    !generationRunning &&
    action.pending !== "generate" &&
    action.pending !== "delete";
  const canCreateExport =
    Boolean(selectedArtwork) &&
    !exportRunning &&
    action.pending !== "export" &&
    action.pending !== "delete";
  const canCreateMockup =
    Boolean(selectedArtwork) &&
    !mockupRunning &&
    action.pending !== "mockup" &&
    action.pending !== "delete";

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
            variant="outline"
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
                  ? "Create Etsy upload ZIP files for this project."
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
          <CreditUsageInfo />
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

      <div className="mt-6 grid gap-4 xl:mt-8 xl:grid-cols-[220px_minmax(0,1fr)_360px] xl:gap-6">
        <div className="order-1 min-w-0 xl:order-1">
          <ArtworkSelectorPanel
            artworks={detail.artworks}
            selectedArtworkId={selectedArtwork?.artworkId ?? null}
            canGenerateVariant={canGenerateVariant}
            generationRunning={generationRunning}
            actionPending={action.pending}
            onGenerateVariant={() => void startVariantGeneration()}
            onSelectArtwork={setSelectedArtworkId}
          />
        </div>

        <section className="order-2 min-w-0 rounded-lg border bg-card p-3 sm:p-4 xl:order-2">
          <SelectedArtworkPreview
            selectedArtwork={selectedArtwork}
            selectedArtworkSrc={selectedArtworkSrc}
            selectedRatioPreset={selectedRatioPreset}
            selectedRatioPixels={selectedRatioPixels}
            selectedSourceWidth={selectedSourceWidth}
            selectedSourceHeight={selectedSourceHeight}
            frameStyle={selectedPreviewFrameStyle}
          />
          <JobStatusPanels
            className="mt-4 hidden xl:grid"
            latestJob={latestJob}
            latestExportJob={latestExportJob}
            retryDisabled={action.pending !== null}
            onRetryGeneration={(jobId) => void retryGeneration(jobId)}
            onRetryExport={(jobId) => void retryExport(jobId)}
          />
        </section>

        <div className="order-3 grid min-w-0 gap-4 xl:order-3">
          <PrintSizesPanel
            projectRatioKeys={projectRatioKeys}
            selectedRatioKey={selectedRatioKey}
            selectedRatioPreset={selectedRatioPreset}
            selectedRatioPixels={selectedRatioPixels}
            latestExportFiles={latestExportJob?.files ?? []}
            onSelectRatio={setSelectedRatioKey}
          />
          <MockupPanel
            latestJob={latestMockupJob}
            packJob={latestMockupPackJob}
            canCreateMockup={canCreateMockup}
            mockupRunning={mockupRunning}
            actionPending={action.pending}
            retryDisabled={action.pending === "delete"}
            onCreate={() => void startMockupPack()}
            onRetry={(jobId) => void retryMockup(jobId)}
          />
        </div>

        <div className="order-4 grid gap-4 xl:hidden">
          <JobStatusPanels
            latestJob={latestJob}
            latestExportJob={latestExportJob}
            retryDisabled={action.pending !== null}
            onRetryGeneration={(jobId) => void retryGeneration(jobId)}
            onRetryExport={(jobId) => void retryExport(jobId)}
          />
          <LastExportFilesPanel files={latestExportJob?.files ?? []} />
        </div>
      </div>
    </main>
  );
}

function CreditUsageInfo() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (detailsRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className="group relative"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        title="Credit usage"
        aria-label="Credit usage"
      >
        <Info className="size-4" />
      </summary>
      <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),22rem)] rounded-md border bg-card p-4 text-sm shadow-lg">
        <p className="font-medium">Credit usage</p>
        <div className="mt-3 grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">5-ratio variant</span>
            <Badge variant="secondary">
              {GENERATION_PREVIEW_CREDIT_COST} credits
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Etsy pack export</span>
            <Badge variant="secondary">{ETSY_PACK_EXPORT_CREDIT_COST} credits</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Mockup pack</span>
            <Badge variant="secondary">{MOCKUP_PACK_CREDIT_COST} credits</Badge>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Credits are reserved when work starts and refunded on technical
          failure.
        </p>
      </div>
    </details>
  );
}

function getDimensionPreviewSrc(
  preview: GeneratedArtworkDimensionPreview | null | undefined
) {
  return preview?.dataUrl ?? preview?.previewUrl ?? null;
}

function SelectedArtworkPreview({
  selectedArtwork,
  selectedArtworkSrc,
  selectedRatioPreset,
  selectedRatioPixels,
  selectedSourceWidth,
  selectedSourceHeight,
  frameStyle
}: {
  selectedArtwork: GeneratedArtworkPreview | null;
  selectedArtworkSrc: string | null;
  selectedRatioPreset: (typeof PRINT_RATIO_PRESETS)[PrintRatioPresetKey];
  selectedRatioPixels: { width: number; height: number };
  selectedSourceWidth: number;
  selectedSourceHeight: number;
  frameStyle: CSSProperties;
}) {
  const frameClassName =
    "relative mx-auto w-full max-w-[min(100%,calc(54svh*var(--preview-ratio-width)/var(--preview-ratio-height)),var(--preview-desktop-max-width))] overflow-hidden rounded-md bg-secondary xl:max-w-[min(100%,var(--preview-desktop-max-width))]";

  if (selectedArtwork && selectedArtworkSrc) {
    return (
      <figure>
        <div className={frameClassName} style={frameStyle}>
          <Image
            src={selectedArtworkSrc}
            alt=""
            fill
            unoptimized
            aria-hidden="true"
            className="scale-110 object-cover opacity-70 blur-2xl"
          />
          <Image
            src={selectedArtworkSrc}
            alt="Selected generated wall-art preview"
            fill
            unoptimized
            className="object-contain"
          />
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-black/50 px-2.5 py-1.5 text-xs text-white backdrop-blur sm:bottom-4 sm:left-4 sm:max-w-[calc(100%-2rem)] sm:px-3 sm:py-2 sm:text-sm">
            <span className="block truncate">
              {selectedRatioPreset.label} · {selectedRatioPixels.width} x{" "}
              {selectedRatioPixels.height} px
            </span>
          </div>
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground sm:text-sm xl:mt-4">
          Generated source: {selectedSourceWidth} x {selectedSourceHeight} px.
          Export preview: {selectedRatioPreset.masterPrintWidthIn} x{" "}
          {selectedRatioPreset.masterPrintHeightIn} in @{" "}
          {selectedRatioPreset.targetDpi} DPI.
        </figcaption>
      </figure>
    );
  }

  return (
    <div
      className={cn(
        frameClassName,
        "grid min-h-[240px] place-items-center border border-dashed px-4 text-center text-sm text-muted-foreground sm:min-h-[280px] xl:min-h-0"
      )}
      style={frameStyle}
    >
      {selectedArtwork
        ? "Preview URL is unavailable."
        : "Generate a preview to start editing this project."}
    </div>
  );
}

function ArtworkSelectorPanel({
  artworks,
  selectedArtworkId,
  canGenerateVariant,
  generationRunning,
  actionPending,
  onGenerateVariant,
  onSelectArtwork
}: {
  artworks: GeneratedArtworkPreview[];
  selectedArtworkId: string | null;
  canGenerateVariant: boolean;
  generationRunning: boolean;
  actionPending: ActionState["pending"];
  onGenerateVariant: () => void;
  onSelectArtwork: (artworkId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="p-4 xl:p-5">
        <div className="flex items-start justify-between gap-3 xl:grid xl:gap-3">
          <div>
            <CardTitle>Artwork</CardTitle>
            <CardDescription>Generated variants</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-3 xl:h-auto xl:min-h-9 xl:w-full xl:whitespace-normal xl:px-2 xl:py-2 xl:text-center xl:leading-tight"
            disabled={!canGenerateVariant}
            onClick={onGenerateVariant}
            title="Generate one additional 5-ratio artwork variant."
          >
            {actionPending === "generate" || generationRunning ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            <span className="xl:hidden">Add variant</span>
            <span className="hidden min-w-0 xl:inline">
              Add 5-Ratio Variant
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 xl:p-5 xl:pt-0">
        {artworks.length > 0 ? (
          <>
            <div className="-mx-4 overflow-x-auto px-4 pb-1 xl:hidden">
              <div className="flex w-max gap-2">
                {artworks.map((artwork) => (
                  <ArtworkThumbnailButton
                    key={artwork.artworkId}
                    artwork={artwork}
                    selected={selectedArtworkId === artwork.artworkId}
                    onSelect={() => onSelectArtwork(artwork.artworkId)}
                  />
                ))}
              </div>
            </div>
            <div className="hidden gap-3 xl:grid">
              {artworks.map((artwork) => (
                <ArtworkButton
                  key={artwork.artworkId}
                  artwork={artwork}
                  selected={selectedArtworkId === artwork.artworkId}
                  onSelect={() => onSelectArtwork(artwork.artworkId)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No generated artwork yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArtworkThumbnailButton({
  artwork,
  selected,
  onSelect
}: {
  artwork: GeneratedArtworkPreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const src = getArtworkPreviewSrc(artwork);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative size-16 shrink-0 overflow-hidden rounded-md border bg-secondary text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-2 ring-primary/25" : ""
      )}
      aria-label={`Select artwork ${artwork.artworkId}`}
      aria-pressed={selected}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="64px"
          unoptimized
          className="object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground">
          No preview
        </span>
      )}
    </button>
  );
}

function MockupPanel({
  latestJob,
  packJob,
  canCreateMockup,
  mockupRunning,
  actionPending,
  retryDisabled,
  onCreate,
  onRetry
}: {
  latestJob: MockupJobView | null;
  packJob: MockupJobView | null;
  canCreateMockup: boolean;
  mockupRunning: boolean;
  actionPending: ActionState["pending"];
  retryDisabled: boolean;
  onCreate: () => void;
  onRetry: (jobId: string) => void;
}) {
  const [downloadState, setDownloadState] = useState<{
    artifactId: string | null;
    error: string | null;
  }>({ artifactId: null, error: null });
  const running = Boolean(
    latestJob && !TERMINAL_MOCKUP_STATUSES.has(latestJob.status)
  );

  async function downloadArtifact(
    jobId: string,
    artifact: MockupJobView["artifacts"][number]
  ) {
    setDownloadState({ artifactId: artifact.artifactId, error: null });

    try {
      const response = await fetchAuthenticatedBlob(
        `/api/app/mockup-jobs/${encodeURIComponent(
          jobId
        )}/artifacts/${encodeURIComponent(artifact.artifactId)}/download`
      );

      triggerBrowserDownload(
        response.blob,
        response.fileName ?? artifact.fileName
      );
      setDownloadState({ artifactId: null, error: null });
    } catch (caughtError) {
      setDownloadState({
        artifactId: null,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Mockup pack could not be downloaded."
      });
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 xl:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Mockups</CardTitle>
            <CardDescription>Optional seller listing images</CardDescription>
          </div>
          <Badge variant="secondary">{MOCKUP_PACK_CREDIT_COST} credits</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 xl:p-5 xl:pt-0">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!canCreateMockup}
          onClick={onCreate}
          title="Create five AI mockup images from the selected artwork and project room."
        >
          {actionPending === "mockup" || mockupRunning ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          Create Mockup Pack
        </Button>

        {latestJob ? (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">Latest mockup job</p>
                <p className="mt-1 text-muted-foreground">
                  {latestJob.stage ?? "queued"} · {latestJob.creditCost}{" "}
                  credits · {formatAppDate(latestJob.createdAt)}
                </p>
              </div>
              <Badge variant={mockupStatusVariant(latestJob.status)}>
                {latestJob.status}
              </Badge>
            </div>

            {running ? (
              <div className="mt-3 flex items-start gap-2 text-muted-foreground">
                <Loader2 className="mt-0.5 size-4 animate-spin" />
                <span>Creating seller mockups from the selected artwork.</span>
              </div>
            ) : null}

            {latestJob.errorMessage ? (
              <div className="mt-3 grid gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                <p className="text-destructive">{latestJob.errorMessage}</p>
                {latestJob.retryable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={retryDisabled || actionPending === "mockup"}
                    onClick={() => onRetry(latestJob.jobId)}
                  >
                    <RefreshCw />
                    Retry mockups
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {packJob ? (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {packJob.status === "succeeded"
                    ? "Last successful mockup pack"
                    : "Last saved mockup pack"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatAppDate(packJob.completedAt ?? packJob.createdAt)} ·{" "}
                  {packJob.images.length} images
                </p>
              </div>
              <Badge
                variant={
                  packJob.status === "succeeded" ? "secondary" : "warning"
                }
              >
                {packJob.status === "succeeded" ? "Ready" : "Saved"}
              </Badge>
            </div>

            {packJob.images.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {packJob.images.map((image) => (
                  <MockupImagePreview
                    key={image.imageId}
                    jobId={packJob.jobId}
                    image={image}
                  />
                ))}
              </div>
            ) : null}

            {downloadState.error ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                {downloadState.error}
              </p>
            ) : null}

            {packJob.artifacts.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {packJob.artifacts.map((artifact) =>
                  artifact.downloadUrl ? (
                    <Button
                      key={artifact.artifactId}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 w-full min-w-0 flex-col items-stretch justify-between gap-1 whitespace-normal px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3"
                    >
                      <a
                        href={artifact.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={artifact.fileName}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
                          {artifact.fileName}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 self-end text-muted-foreground sm:self-auto">
                          {formatBytes(artifact.bytes)}
                          <Download />
                        </span>
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={artifact.artifactId}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 w-full min-w-0 flex-col items-stretch justify-between gap-1 whitespace-normal px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3"
                      disabled={
                        downloadState.artifactId === artifact.artifactId
                      }
                      onClick={() =>
                        void downloadArtifact(packJob.jobId, artifact)
                      }
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
                        {artifact.fileName}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 self-end text-muted-foreground sm:self-auto">
                        {formatBytes(artifact.bytes)}
                        {downloadState.artifactId === artifact.artifactId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download />
                        )}
                      </span>
                    </Button>
                  )
                )}
              </div>
            ) : null}
          </div>
        ) : latestJob ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No saved mockup pack yet.
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Create mockups after choosing a generated artwork.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MockupImagePreview({
  jobId,
  image
}: {
  jobId: string;
  image: MockupJobView["images"][number];
}) {
  const directSrc = image.dataUrl ?? null;
  const [preview, setPreview] = useState<{
    src: string | null;
    loading: boolean;
    error: string | null;
  }>({
    src: null,
    loading: !directSrc,
    error: null
  });

  useEffect(() => {
    if (directSrc) {
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      try {
        const response = await fetchAuthenticatedBlob(
          `/api/app/mockup-jobs/${encodeURIComponent(
            jobId
          )}/images/${encodeURIComponent(image.imageId)}/preview`
        );
        const dataUrl = await blobToDataUrl(response.blob);

        if (!cancelled) {
          setPreview({ src: dataUrl, loading: false, error: null });
        }
      } catch (caughtError) {
        if (!cancelled) {
          setPreview({
            src: image.previewUrl ?? null,
            loading: false,
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Mockup preview could not be loaded."
          });
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [directSrc, image.imageId, image.previewUrl, jobId]);

  const src = directSrc ?? preview.src;

  return (
    <div
      className="relative aspect-square overflow-hidden rounded-md bg-secondary"
      title={preview.error ?? image.fileName}
    >
      {src ? (
        <Image
          src={src}
          alt="Generated Etsy mockup"
          fill
          unoptimized
          sizes="(min-width: 1280px) 150px, 45vw"
          className="object-cover"
        />
      ) : preview.loading ? (
        <span className="grid size-full place-items-center px-3 text-center text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </span>
      ) : (
        <span className="grid size-full place-items-center px-3 text-center text-xs text-muted-foreground">
          Preview unavailable
        </span>
      )}
    </div>
  );
}

function PrintSizesPanel({
  projectRatioKeys,
  selectedRatioKey,
  selectedRatioPreset,
  selectedRatioPixels,
  latestExportFiles,
  onSelectRatio
}: {
  projectRatioKeys: PrintRatioPresetKey[];
  selectedRatioKey: PrintRatioPresetKey;
  selectedRatioPreset: (typeof PRINT_RATIO_PRESETS)[PrintRatioPresetKey];
  selectedRatioPixels: { width: number; height: number };
  latestExportFiles: ExportJobView["files"];
  onSelectRatio: (ratioKey: PrintRatioPresetKey) => void;
}) {
  return (
    <>
      <Card className="xl:hidden">
        <CardHeader className="p-4">
          <CardTitle>Print sizes</CardTitle>
          <CardDescription>Choose an Etsy ratio</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0">
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex w-max gap-2">
              {projectRatioKeys.map((key) => {
                const preset = PRINT_RATIO_PRESETS[key];

                return (
                  <RatioChipButton
                    key={key}
                    presetKey={key}
                    label={preset.label}
                    selected={selectedRatioKey === key}
                    onSelect={() => onSelectRatio(key)}
                  />
                );
              })}
            </div>
          </div>
          <SelectedRatioSummary
            selectedRatioKey={selectedRatioKey}
            selectedRatioPreset={selectedRatioPreset}
            selectedRatioPixels={selectedRatioPixels}
            compact
          />
        </CardContent>
      </Card>

      <Card className="hidden xl:block">
        <CardHeader>
          <CardTitle>Print sizes</CardTitle>
          <CardDescription>Selected ratio and export pixels</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SelectedRatioSummary
            selectedRatioKey={selectedRatioKey}
            selectedRatioPreset={selectedRatioPreset}
            selectedRatioPixels={selectedRatioPixels}
          />
          {projectRatioKeys.map((key) => {
            const preset = PRINT_RATIO_PRESETS[key];

            return (
              <RatioPreviewButton
                key={key}
                presetKey={key}
                label={preset.label}
                printSize={formatPrintSize(preset)}
                selected={selectedRatioKey === key}
                onSelect={() => onSelectRatio(key)}
              />
            );
          })}
          <LastExportFilesPanel files={latestExportFiles} />
        </CardContent>
      </Card>
    </>
  );
}

function SelectedRatioSummary({
  selectedRatioKey,
  selectedRatioPreset,
  selectedRatioPixels,
  compact = false
}: {
  selectedRatioKey: PrintRatioPresetKey;
  selectedRatioPreset: (typeof PRINT_RATIO_PRESETS)[PrintRatioPresetKey];
  selectedRatioPixels: { width: number; height: number };
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-secondary/40",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{selectedRatioPreset.label}</p>
        <Badge variant="secondary">{selectedRatioKey}</Badge>
      </div>
      <dl
        className={cn(
          "mt-3 grid gap-2 text-sm",
          compact ? "grid-cols-2 gap-x-3" : ""
        )}
      >
        <div>
          <dt className="text-muted-foreground">Print Size</dt>
          <dd>{formatPrintSize(selectedRatioPreset)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Export pixels</dt>
          <dd className="font-mono">
            {selectedRatioPixels.width} x {selectedRatioPixels.height} px
          </dd>
        </div>
      </dl>
    </div>
  );
}

function RatioChipButton({
  presetKey,
  label,
  selected,
  onSelect
}: {
  presetKey: PrintRatioPresetKey;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm transition hover:border-primary hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-primary/10 ring-2 ring-primary/25" : ""
      )}
    >
      <span className="font-medium">{presetKey}</span>
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
}

function RatioPreviewButton({
  presetKey,
  label,
  printSize,
  selected,
  onSelect
}: {
  presetKey: PrintRatioPresetKey;
  label: string;
  printSize: string;
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
  const src = getArtworkPreviewSrc(artwork);

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

function getArtworkPreviewSrc(artwork: GeneratedArtworkPreview) {
  return (
    artwork.dataUrl ??
    artwork.previewUrl ??
    artwork.dimensionPreviews?.[0]?.dataUrl ??
    artwork.dimensionPreviews?.[0]?.previewUrl
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error("Preview image could not be decoded."));
    };
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Preview image could not be decoded."));
    };
    reader.readAsDataURL(blob);
  });
}

function JobStatusPanels({
  latestJob,
  latestExportJob,
  retryDisabled,
  onRetryGeneration,
  onRetryExport,
  className
}: {
  latestJob: GenerationJobView | null;
  latestExportJob: ExportJobView | null;
  retryDisabled: boolean;
  onRetryGeneration: (jobId: string) => void;
  onRetryExport: (jobId: string) => void;
  className?: string;
}) {
  if (!latestJob && !latestExportJob) {
    return null;
  }

  return (
    <div className={cn("grid gap-4", className)}>
      {latestJob ? (
        <GenerationJobPanel
          job={latestJob}
          retryDisabled={retryDisabled}
          onRetry={onRetryGeneration}
        />
      ) : null}
      {latestExportJob ? (
        <ExportJobPanel
          job={latestExportJob}
          onRetry={onRetryExport}
          retryDisabled={retryDisabled}
        />
      ) : null}
    </div>
  );
}

function GenerationJobPanel({
  job,
  onRetry,
  retryDisabled
}: {
  job: GenerationJobView;
  onRetry: (jobId: string) => void;
  retryDisabled: boolean;
}) {
  return (
    <div className="rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">Latest generation job</p>
        <Badge variant={generationStatusVariant(job.status)}>
          {job.status}
        </Badge>
      </div>
      <p className="mt-2 text-muted-foreground">
        {job.stage ?? "queued"} · {job.creditCost} credits ·{" "}
        {formatAppDate(job.createdAt)}
      </p>
      {job.errorMessage ? (
        <div className="mt-3 grid gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p className="text-destructive">{job.errorMessage}</p>
          {job.retryable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={retryDisabled}
              onClick={() => onRetry(job.jobId)}
            >
              <RefreshCw />
              Retry generation
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExportJobPanel({
  job,
  onRetry,
  retryDisabled
}: {
  job: ExportJobView;
  onRetry: (jobId: string) => void;
  retryDisabled: boolean;
}) {
  const [downloadState, setDownloadState] = useState<{
    artifactId: string | null;
    error: string | null;
  }>({ artifactId: null, error: null });
  const running = !TERMINAL_EXPORT_STATUSES.has(job.status);
  const warnings = compactExportWarnings(job.warnings);

  async function downloadArtifact(artifact: ExportJobView["artifacts"][number]) {
    setDownloadState({ artifactId: artifact.artifactId, error: null });

    try {
      const response = await fetchAuthenticatedBlob(
        `/api/app/export-jobs/${encodeURIComponent(
          job.jobId
        )}/artifacts/${encodeURIComponent(artifact.artifactId)}/download`
      );

      triggerBrowserDownload(
        response.blob,
        response.fileName ?? artifact.fileName
      );
      setDownloadState({ artifactId: null, error: null });
    } catch (caughtError) {
      setDownloadState({
        artifactId: null,
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Export file could not be downloaded."
      });
    }
  }

  return (
    <div className="rounded-md border p-4 text-sm">
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
        <div className="mt-4 flex items-start gap-2 text-muted-foreground">
          <Loader2 className="mt-0.5 size-4 animate-spin" />
          <span>
            <span className="block">Creating print files and Etsy ZIPs.</span>
            <span className="block text-xs">
              Large print files can take a few minutes.
            </span>
          </span>
        </div>
      ) : null}

      {job.errorMessage ? (
        <div className="mt-3 grid gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p className="text-destructive">{job.errorMessage}</p>
          {job.retryable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={retryDisabled}
              onClick={() => onRetry(job.jobId)}
            >
              <RefreshCw />
              Retry export
            </Button>
          ) : null}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2">
          {warnings.map((warning, index) => (
            <p key={`${warning}-${index}`}>{warning}</p>
          ))}
        </div>
      ) : null}

      {downloadState.error ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          {downloadState.error}
        </p>
      ) : null}

      {job.artifacts.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {job.artifacts.map((artifact) =>
            artifact.downloadUrl ? (
              <Button
                key={artifact.artifactId}
                asChild
                variant="outline"
                size="sm"
                className="h-auto min-h-9 w-full min-w-0 flex-col items-stretch justify-between gap-1 whitespace-normal px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3"
              >
                <a
                  href={artifact.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={artifact.fileName}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
                    {artifact.fileName}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-2 self-end text-muted-foreground sm:self-auto">
                    {formatBytes(artifact.bytes)}
                    <Download />
                  </span>
                </a>
              </Button>
            ) : (
              <Button
                key={artifact.artifactId}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 w-full min-w-0 flex-col items-stretch justify-between gap-1 whitespace-normal px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3"
                disabled={downloadState.artifactId === artifact.artifactId}
                onClick={() => void downloadArtifact(artifact)}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
                  {artifact.fileName}
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 self-end text-muted-foreground sm:self-auto">
                  {formatBytes(artifact.bytes)}
                  {downloadState.artifactId === artifact.artifactId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download />
                  )}
                </span>
              </Button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

function LastExportFilesPanel({ files }: { files: ExportJobView["files"] }) {
  if (!files.length) {
    return null;
  }

  return (
    <div className="rounded-md border p-4 text-sm">
      <p className="font-medium">Last export files</p>
      <div className="mt-3 grid gap-2">
        {files.map((file) => (
          <div
            key={file.fileName}
            className="flex min-w-0 flex-col gap-1 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span className="min-w-0">
              <span className="block break-all font-mono text-xs">
                {file.fileName}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {file.width} x {file.height} px
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(file.bytes)}
            </span>
          </div>
        ))}
      </div>
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
          Free includes one-time preview credits. Etsy upload ZIPs, exact print
          files, listing copy, and buyer instructions are available on paid
          plans.
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
  return detail.project.printRatioKeys.length > 0
    ? detail.project.printRatioKeys
    : DEFAULT_AUTOMATIC_PRINT_RATIO_KEYS;
}

function compactExportWarnings(warnings: string[]) {
  let hasEnlargementWarning = false;
  const otherWarnings: string[] = [];

  for (const warning of warnings) {
    const match = /^.+ was enlarged (\d+(?:\.\d+)?)x from the working image to reach the selected print size\. (?:Fine detail may look softer at the largest print sizes\.|Review detail quality before listing\.)$/.exec(
      warning
    );

    if (match) {
      hasEnlargementWarning = true;
      continue;
    }

    otherWarnings.push(warning);
  }

  if (!hasEnlargementWarning) {
    return otherWarnings;
  }

  return [
    "Print sizes were enlarged. Check detail before listing.",
    ...otherWarnings
  ];
}

function formatPrintSize(
  preset: (typeof PRINT_RATIO_PRESETS)[PrintRatioPresetKey]
) {
  return `${formatInches(preset.masterPrintWidthIn)} x ${formatInches(
    preset.masterPrintHeightIn
  )} in`;
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

function mergeMockupJob(
  detail: ProjectDetail | null,
  job: MockupJobView
): ProjectDetail | null {
  if (!detail) {
    return detail;
  }

  const mockupJobs = [
    job,
    ...detail.mockupJobs.filter((candidate) => candidate.jobId !== job.jobId)
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestMockupPackJob = findLatestMockupPackJob([
    ...mockupJobs,
    ...(detail.latestMockupPackJob ? [detail.latestMockupPackJob] : [])
  ]);

  return {
    ...detail,
    mockupJobs,
    latestMockupJob: mockupJobs[0] ?? null,
    latestMockupPackJob
  };
}

function findLatestMockupPackJob(jobs: MockupJobView[]) {
  return (
    jobs
      .filter(hasMockupPackAssets)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

function hasMockupPackAssets(job: MockupJobView) {
  return job.images.length > 0 || job.artifacts.length > 0;
}

function mergeGenerationJob(
  detail: ProjectDetail | null,
  job: GenerationJobView
): ProjectDetail | null {
  if (!detail) {
    return detail;
  }

  const generationJobs = [
    job,
    ...detail.generationJobs.filter(
      (candidate) => candidate.jobId !== job.jobId
    )
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const artworkById = new Map(
    [...job.artworks, ...detail.artworks].map((artwork) => [
      artwork.artworkId,
      artwork
    ])
  );

  return {
    ...detail,
    generationJobs,
    latestGenerationJob: generationJobs[0] ?? null,
    artworks: [...artworkById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
  };
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

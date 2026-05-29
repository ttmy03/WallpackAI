"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Info,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent
} from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import { useFirebaseAuthUser } from "@/components/auth/use-firebase-auth-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readApiResponse } from "@/lib/app/api-client";
import type { DashboardSummary } from "@/lib/app/api-types";
import {
  GENERATION_PREVIEW_CREDIT_COST,
  FREE_PLAN_ONE_TIME_PREVIEW_CREDITS,
  type PlanStatus
} from "@/lib/billing/plans";
import type { GenerationJobView } from "@/lib/jobs/generation-types";
import {
  getAutomaticPrintRatioKeys,
  getDefaultPrimaryPrintRatioKey,
  getPrintRatioOrientation,
  PRINT_RATIO_PRESETS,
  type PrintOrientation
} from "@/lib/print/presets";
import { buildWallArtPrompt, PromptBlockedError } from "@/lib/prompts/builder";
import { PALETTE_PRESETS, STYLE_PRESETS } from "@/lib/prompts/presets";
import type { PalettePresetKey, StylePresetKey } from "@/lib/prompts/presets";
import { type PromptInput, promptInputSchema } from "@/lib/prompts/schema";
import { cn } from "@/lib/utils";

const steps = ["Concept", "Style", "Palette", "Composition", "Generate"];
const terminalGenerationStatuses = new Set([
  "succeeded",
  "failed",
  "cancelled"
]);

type QueueGenerationResponse = {
  jobId: string;
  status: GenerationJobView["status"];
  projectId: string;
};

const starterInput: PromptInput = {
  packName: "Japandi Mountain Set",
  subject: "minimalist mountain landscape",
  niche: "neutral printable art",
  room: "living room",
  stylePresetKey: "japandi_minimal",
  paletteKey: "warm_neutral_sage",
  mood: "calm and serene",
  composition: "centered with large negative space",
  avoid: ["text", "logos", "watermarks", "people", "hands", "signatures"],
  primaryRatio: "2x3"
};

const compositionOptions = [
  "centered with large negative space",
  "landscape scene with clear horizon",
  "abstract full bleed with safe center",
  "minimal subject away from edges",
  "symmetrical pattern with central focus"
];

type StyleExampleVariant =
  | "japandi"
  | "botanical"
  | "abstract"
  | "nursery"
  | "vintage"
  | "geometry"
  | "coastal"
  | "academia";

type CompositionExampleVariant =
  | "centered"
  | "landscape"
  | "full_bleed"
  | "minimal_edge"
  | "symmetrical";

type FloatingExamplePreview =
  | { kind: "style"; styleKey: StylePresetKey }
  | { kind: "palette"; paletteKey: PalettePresetKey }
  | { kind: "composition"; composition: string };

type PointerPosition = {
  x: number;
  y: number;
};

const styleExampleVariants: Record<StylePresetKey, StyleExampleVariant> = {
  japandi_minimal: "japandi",
  boho_botanical: "botanical",
  abstract_neutral: "abstract",
  nursery_soft: "nursery",
  vintage_landscape: "vintage",
  islamic_geometry: "geometry",
  coastal_calm: "coastal",
  dark_academia: "academia"
};

const styleExamplePalettes: Record<StylePresetKey, string[]> = {
  japandi_minimal: ["#efe7d8", "#b8aa8c", "#7d9271", "#2f3f35"],
  boho_botanical: ["#ead8bf", "#c96f45", "#8e5a3c", "#5f744c"],
  abstract_neutral: ["#eee8dc", "#d1c4b2", "#8c8174", "#2e2e2d"],
  nursery_soft: ["#f7d8cf", "#c9dded", "#f5efd9", "#bfd2bd"],
  vintage_landscape: ["#d7c3a1", "#8d795e", "#5c6d55", "#3f3328"],
  islamic_geometry: ["#f4ead7", "#1f5138", "#b26743", "#26364b"],
  coastal_calm: ["#e9e1d2", "#9bbdc2", "#5c7e94", "#8a8172"],
  dark_academia: ["#d7c2a1", "#6d4932", "#2f241c", "#16120f"]
};

const compositionExampleVariants: Record<string, CompositionExampleVariant> = {
  "centered with large negative space": "centered",
  "landscape scene with clear horizon": "landscape",
  "abstract full bleed with safe center": "full_bleed",
  "minimal subject away from edges": "minimal_edge",
  "symmetrical pattern with central focus": "symmetrical"
};

const paletteColorHex: Record<string, string> = {
  black: "#111111",
  "burnt orange": "#b55d2b",
  "clay brown": "#7a4f36",
  cream: "#f3ead8",
  "driftwood gray": "#8a8172",
  ivory: "#f5f0e5",
  "muted blue": "#5c7e94",
  "muted sage": "#8fa083",
  "pale sage": "#bfd2bd",
  "powder blue": "#b8d3e6",
  sand: "#d9c7aa",
  seafoam: "#9fc9c2",
  "soft charcoal": "#3e403d",
  "soft peach": "#f2c8b8",
  terracotta: "#c66d45",
  "warm beige": "#d8c6aa",
  "warm gray": "#8c8981",
  white: "#f8f7f4"
};

export function ProjectWizard() {
  const { state: authState } = useFirebaseAuthUser();
  const authUser = authState.status === "ready" ? authState.user : null;
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<PromptInput>(starterInput);
  const [generationJob, setGenerationJob] = useState<GenerationJobView | null>(
    null
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [floatingPreview, setFloatingPreview] =
    useState<FloatingExamplePreview | null>(null);
  const [floatingPreviewPosition, setFloatingPreviewPosition] =
    useState<PointerPosition | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const result = useMemo(() => {
    const parsed = promptInputSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false as const,
        message: parsed.error.issues[0]?.message ?? "Check your inputs."
      };
    }

    try {
      return { ok: true as const, built: buildWallArtPrompt(parsed.data) };
    } catch (error) {
      if (error instanceof PromptBlockedError) {
        return {
          ok: false as const,
          message: error.details.message,
          suggestion: error.details.suggestion
        };
      }

      return { ok: false as const, message: "The prompt could not be built." };
    }
  }, [input]);

  const selectedOrientation = getPrintRatioOrientation(input.primaryRatio);
  const defaultPrimaryRatio =
    getDefaultPrimaryPrintRatioKey(selectedOrientation);
  const automaticRatioKeys = getAutomaticPrintRatioKeys(selectedOrientation);
  const defaultRatioDisplay = formatRatioKey(defaultPrimaryRatio);
  const isFreePlan = planStatus?.planKey === "free";
  const previewCreditCost = GENERATION_PREVIEW_CREDIT_COST;
  const freePreviewCreditsRemaining = isFreePlan ? creditBalance : null;
  const freePreviewLimitReached =
    isFreePlan &&
    freePreviewCreditsRemaining !== null &&
    freePreviewCreditsRemaining < previewCreditCost;

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (input.primaryRatio === defaultPrimaryRatio) {
      return;
    }

    setInput((current) => {
      const currentOrientation = getPrintRatioOrientation(current.primaryRatio);
      const primaryRatio = getDefaultPrimaryPrintRatioKey(currentOrientation);

      return current.primaryRatio === primaryRatio
        ? current
        : { ...current, primaryRatio };
    });
  }, [defaultPrimaryRatio, input.primaryRatio]);

  useEffect(() => {
    let cancelled = false;

    if (!authUser) {
      setPlanStatus(null);
      setCreditBalance(null);
      return;
    }

    async function loadPlanStatus() {
      try {
        const dashboard =
          await fetchAuthenticatedApi<DashboardSummary>("/api/app/dashboard");

        if (!cancelled) {
          setPlanStatus(dashboard.plan);
          setCreditBalance(dashboard.creditBalance);
        }
      } catch {
        if (!cancelled) {
          setPlanStatus(null);
          setCreditBalance(null);
        }
      }
    }

    void loadPlanStatus();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const pollGenerationJob = useCallback(async function pollGenerationJob(
    jobId: string,
    token: string
  ) {
    const response = await fetch(`/api/app/generation-jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const payload = await readApiResponse<GenerationJobView>(response);

    if (!payload.ok) {
      throw new Error(payload.error.message);
    }

    setGenerationJob(payload.data);

    if (!terminalGenerationStatuses.has(payload.data.status)) {
      pollTimeoutRef.current = setTimeout(() => {
        void pollGenerationJob(jobId, token).catch((error: unknown) => {
          setGenerationError(
            error instanceof Error
              ? error.message
              : "Generation status could not be loaded."
          );
        });
      }, 1200);
    } else {
      void fetchAuthenticatedApi<DashboardSummary>("/api/app/dashboard")
        .then((dashboard) => {
          setPlanStatus(dashboard.plan);
          setCreditBalance(dashboard.creditBalance);
        })
        .catch(() => undefined);
    }
  }, []);

  async function handleGenerate() {
    if (!result.ok || isQueueingGeneration) {
      return;
    }

    if (freePreviewLimitReached) {
      setGenerationError(
        `You need ${previewCreditCost} credits to generate a 5-ratio preview.`
      );
      return;
    }

    if (!authUser) {
      setGenerationError("Sign in with Google before generating previews.");
      return;
    }

    setGenerationError(null);
    setGenerationJob(null);
    setIsQueueingGeneration(true);

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    try {
      const token = await authUser.getIdToken();
      const generationBody = activeProjectId
        ? {
            projectId: activeProjectId,
            promptInputs: input,
            previewCount: 1,
            quality: "draft"
          }
        : {
            projectName: input.packName,
            promptInputs: input,
            previewCount: 1,
            quality: "draft"
          };
      const response = await fetch("/api/app/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(generationBody)
      });
      const payload = await readApiResponse<QueueGenerationResponse>(response);

      if (!payload.ok) {
        throw new Error(payload.error.message);
      }

      setActiveProjectId(payload.data.projectId);
      setCreditBalance((current) =>
        current === null ? current : Math.max(0, current - previewCreditCost)
      );
      await pollGenerationJob(payload.data.jobId, token);
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Generation could not be started."
      );
    } finally {
      setIsQueueingGeneration(false);
    }
  }

  const isGenerationRunning =
    isQueueingGeneration ||
    Boolean(
      generationJob && !terminalGenerationStatuses.has(generationJob.status)
    );

  function handleOrientationChange(orientation: PrintOrientation) {
    const primaryRatio = getDefaultPrimaryPrintRatioKey(orientation);

    setInput((current) => ({
      ...current,
      primaryRatio
    }));
  }

  function updateFloatingPreviewPosition(event: MouseEvent<HTMLElement>) {
    setFloatingPreviewPosition({
      x: event.clientX,
      y: event.clientY
    });
  }

  function showStylePreview(
    styleKey: StylePresetKey,
    event: MouseEvent<HTMLElement>
  ) {
    setFloatingPreview({ kind: "style", styleKey });
    updateFloatingPreviewPosition(event);
  }

  function showPalettePreview(
    paletteKey: PalettePresetKey,
    event: MouseEvent<HTMLElement>
  ) {
    setFloatingPreview({ kind: "palette", paletteKey });
    updateFloatingPreviewPosition(event);
  }

  function showCompositionPreview(
    composition: string,
    event: MouseEvent<HTMLElement>
  ) {
    setFloatingPreview({ kind: "composition", composition });
    updateFloatingPreviewPosition(event);
  }

  function hideFloatingPreview() {
    setFloatingPreview(null);
    setFloatingPreviewPosition(null);
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-lg border bg-card">
          <div className="border-b p-5">
            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition",
                    step === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {step === 0 ? (
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="packName">Pack name</Label>
                  <Input
                    id="packName"
                    value={input.packName ?? ""}
                    onChange={(event) =>
                      setInput({ ...input, packName: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject or theme</Label>
                  <Input
                    id="subject"
                    value={input.subject}
                    onChange={(event) =>
                      setInput({ ...input, subject: event.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Examples: minimalist mountain landscape, boho botanical
                    wildflower set, neutral abstract shapes.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="niche">Etsy niche</Label>
                    <Input
                      id="niche"
                      value={input.niche ?? ""}
                      onChange={(event) =>
                        setInput({ ...input, niche: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">Room or use case</Label>
                    <Input
                      id="room"
                      value={input.room}
                      onChange={(event) =>
                        setInput({ ...input, room: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Pack format</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={selectedOrientation === "portrait"}
                      onClick={() => handleOrientationChange("portrait")}
                      className={cn(
                        "rounded-lg border p-4 text-left transition hover:bg-secondary",
                        selectedOrientation === "portrait" &&
                          "border-primary bg-secondary"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <RectangleVertical className="size-5 text-primary" />
                        <span className="font-medium">Portrait pack</span>
                      </span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        Vertical wall art for poster and gallery frames.
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={selectedOrientation === "landscape"}
                      onClick={() => handleOrientationChange("landscape")}
                      className={cn(
                        "rounded-lg border p-4 text-left transition hover:bg-secondary",
                        selectedOrientation === "landscape" &&
                          "border-primary bg-secondary"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <RectangleHorizontal className="size-5 text-primary" />
                        <span className="font-medium">Landscape pack</span>
                      </span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        Horizontal wall art for wide prints and frames.
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Object.values(STYLE_PRESETS).map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() =>
                      setInput({
                        ...input,
                        stylePresetKey: style.key as StylePresetKey
                      })
                    }
                    onMouseEnter={(event) =>
                      showStylePreview(style.key as StylePresetKey, event)
                    }
                    onMouseMove={updateFloatingPreviewPosition}
                    onMouseLeave={hideFloatingPreview}
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:bg-secondary",
                      input.stylePresetKey === style.key &&
                        "border-primary bg-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{style.label}</p>
                      {input.stylePresetKey === style.key ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {style.description}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Best for {style.bestFor.join(", ")}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.values(PALETTE_PRESETS).map((palette) => (
                    <button
                      key={palette.key}
                      type="button"
                      onClick={() =>
                        setInput({
                          ...input,
                          paletteKey: palette.key as PalettePresetKey
                        })
                      }
                      onMouseEnter={(event) =>
                        showPalettePreview(
                          palette.key as PalettePresetKey,
                          event
                        )
                      }
                      onMouseMove={updateFloatingPreviewPosition}
                      onMouseLeave={hideFloatingPreview}
                      className={cn(
                        "rounded-lg border p-4 text-left transition hover:bg-secondary",
                        input.paletteKey === palette.key &&
                          "border-primary bg-secondary"
                      )}
                    >
                      <p className="font-medium">{palette.label}</p>
                      <PaletteSwatches colors={palette.colors} />
                      <p className="mt-3 text-xs text-muted-foreground">
                        {palette.colors.join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customPalette">Custom palette</Label>
                  <Input
                    id="customPalette"
                    value={input.customPalette ?? ""}
                    onChange={(event) =>
                      setInput({ ...input, customPalette: event.target.value })
                    }
                    placeholder="optional colors"
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="mood">Mood</Label>
                  <Input
                    id="mood"
                    value={input.mood}
                    onChange={(event) =>
                      setInput({ ...input, mood: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {compositionOptions.map((composition) => (
                    <button
                      key={composition}
                      type="button"
                      onClick={() => setInput({ ...input, composition })}
                      onMouseEnter={(event) =>
                        showCompositionPreview(composition, event)
                      }
                      onMouseMove={updateFloatingPreviewPosition}
                      onMouseLeave={hideFloatingPreview}
                      className={cn(
                        "rounded-lg border p-4 text-left text-sm transition hover:bg-secondary",
                        input.composition === composition &&
                          "border-primary bg-secondary"
                      )}
                    >
                      {composition}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm text-accent-foreground">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p>
                      For multi-ratio Etsy packs, keep important details away
                      from edges.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-5">
                <Textarea
                  readOnly
                  value={result.ok ? result.built.prompt : result.message}
                  className="min-h-72 font-mono text-xs"
                />
                {!result.ok ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <p className="font-medium">Prompt blocked</p>
                    <p className="mt-2 text-muted-foreground">
                      {result.message}
                    </p>
                    {"suggestion" in result ? (
                      <p className="mt-2 text-muted-foreground">
                        Suggestion: {result.suggestion}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {generationJob || generationError || isQueueingGeneration ? (
                  <div className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="size-4 text-primary" />
                        <p className="font-medium">5-ratio generation</p>
                      </div>
                      <Badge
                        variant={
                          generationJob?.status === "failed"
                            ? "warning"
                            : generationJob?.status === "succeeded"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {generationJob?.status ?? "queueing"}
                      </Badge>
                    </div>

                    {generationJob ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {generationJob.stage ?? "queued"} ·{" "}
                        {generationJob.creditCost} credits
                        {generationJob.creditCommitted
                          ? " committed"
                          : " reserved"}
                      </p>
                    ) : null}

                    {generationError ? (
                      <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {generationError}
                      </div>
                    ) : null}

                    {generationJob?.errorMessage ? (
                      <div className="mt-4 grid gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                        <p className="text-destructive">
                          {generationJob.errorMessage}
                        </p>
                        {generationJob.retryable ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-fit"
                            disabled={isGenerationRunning}
                            onClick={handleGenerate}
                          >
                            <RefreshCw />
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {generationJob?.artworks.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {generationJob.artworks.map((artwork, index) => {
                          const previewSrc =
                            artwork.dataUrl ?? artwork.previewUrl;

                          return (
                            <figure
                              key={artwork.artworkId}
                              className="overflow-hidden rounded-md border bg-secondary"
                            >
                              {previewSrc ? (
                                <Image
                                  src={previewSrc}
                                  alt={`Generated wall-art preview ${index + 1}`}
                                  width={artwork.width}
                                  height={artwork.height}
                                  unoptimized
                                  className="w-full object-cover"
                                  style={{
                                    aspectRatio: `${artwork.width} / ${artwork.height}`
                                  }}
                                />
                              ) : (
                                <div
                                  className="grid place-items-center text-sm text-muted-foreground"
                                  style={{
                                    aspectRatio: `${PRINT_RATIO_PRESETS[input.primaryRatio].ratioWidth} / ${PRINT_RATIO_PRESETS[input.primaryRatio].ratioHeight}`
                                  }}
                                >
                                  Preview pending
                                </div>
                              )}
                              <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
                                {artwork.width} x {artwork.height} px
                              </figcaption>
                            </figure>
                          );
                        })}
                      </div>
                    ) : null}

                    {generationJob?.projectId ? (
                      <Button asChild variant="outline" className="mt-4 w-fit">
                        <Link
                          href={`/app/projects/${generationJob.projectId}/editor`}
                        >
                          Open project editor
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                <ChevronLeft />
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setStep((current) =>
                      Math.min(current + 1, steps.length - 1)
                    )
                  }
                >
                  Next
                  <ChevronRight />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    disabled={
                      !result.ok ||
                      isGenerationRunning ||
                      freePreviewLimitReached
                    }
                    onClick={handleGenerate}
                  >
                    {isGenerationRunning ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Sparkles />
                    )}
                    {isGenerationRunning
                      ? "Generating ratios"
                      : freePreviewLimitReached
                        ? "Not enough credits"
                        : "Generate 5 ratios"}
                  </Button>
                  <GenerateCreditInfo
                    isFreePlan={isFreePlan}
                    previewCreditCost={previewCreditCost}
                    freePreviewCreditsRemaining={freePreviewCreditsRemaining}
                    freePreviewLimitReached={freePreviewLimitReached}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="grid h-fit gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pack summary</CardTitle>
              <CardDescription>
                Guided input is converted into a safe wall-art prompt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <SummaryRow label="Subject" value={input.subject} />
              <SummaryRow label="Room" value={input.room} />
              <SummaryRow
                label="Format"
                value={
                  selectedOrientation === "landscape" ? "Landscape" : "Portrait"
                }
              />
              <SummaryRow
                label="Style"
                value={STYLE_PRESETS[input.stylePresetKey].label}
              />
              <SummaryRow
                label="Palette"
                value={PALETTE_PRESETS[input.paletteKey].label}
              />
              <SummaryRow
                label="Generate ratio"
                value={`${defaultRatioDisplay} ${
                  selectedOrientation === "landscape" ? "Landscape" : "Vertical"
                }`}
              />
              <SummaryRow
                label="Print sizes"
                value={automaticRatioKeys
                  .flatMap(
                    (key) => PRINT_RATIO_PRESETS[key].supportedPrintSizes
                  )
                  .join(", ")}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="secondary">5 ratio sources</Badge>
                {isFreePlan ? (
                  <Badge variant="secondary">
                    {freePreviewCreditsRemaining ?? 0} free credits left
                  </Badge>
                ) : (
                  <Badge variant="secondary">{previewCreditCost} credits</Badge>
                )}
                <Badge variant={result.ok ? "default" : "warning"}>
                  {result.ok ? "Prompt allowed" : "Needs edit"}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Etsy guardrails</CardTitle>
              <CardDescription>
                Default exports target up to five files, each under 18 MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              AI disclosure, no-physical-item copy, and exact pixels are kept in
              the export path by default.
            </CardContent>
          </Card>
        </aside>
      </div>
      <HoverExamplePreview
        preview={floatingPreview}
        position={floatingPreviewPosition}
        currentStyleKey={input.stylePresetKey}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  );
}

function HoverExamplePreview({
  preview,
  position,
  currentStyleKey
}: {
  preview: FloatingExamplePreview | null;
  position: PointerPosition | null;
  currentStyleKey: StylePresetKey;
}) {
  if (!preview || !position) {
    return null;
  }

  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const previewWidth = 192;
  const previewHeight = 306;
  const placeLeft =
    viewportWidth > 0 && position.x + previewWidth + 24 > viewportWidth;
  const placeAbove =
    viewportHeight > 0 && position.y + previewHeight + 24 > viewportHeight;
  const title =
    preview.kind === "style"
      ? STYLE_PRESETS[preview.styleKey].label
      : preview.kind === "palette"
        ? PALETTE_PRESETS[preview.paletteKey].label
        : preview.composition;
  const description =
    preview.kind === "style"
      ? "Style example"
      : preview.kind === "palette"
        ? "Palette example"
        : "Composition example";

  return (
    <div
      className="pointer-events-none fixed z-[100] w-48 rounded-md border bg-card p-2 text-sm shadow-xl"
      style={{
        left: placeLeft ? position.x - previewWidth - 14 : position.x + 14,
        top: placeAbove ? position.y - previewHeight - 14 : position.y + 14
      }}
      aria-hidden="true"
    >
      <p className="truncate font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-2">
        {preview.kind === "style" ? (
          <ArtworkExampleImage
            variant={styleExampleVariants[preview.styleKey]}
            colors={styleExamplePalettes[preview.styleKey]}
          />
        ) : null}
        {preview.kind === "palette" ? (
          <>
            <ArtworkExampleImage
              variant="abstract"
              colors={PALETTE_PRESETS[preview.paletteKey].colors.map(
                colorToHex
              )}
            />
            <PaletteSwatches
              colors={PALETTE_PRESETS[preview.paletteKey].colors}
              className="mt-2"
            />
          </>
        ) : null}
        {preview.kind === "composition" ? (
          <CompositionExampleImage
            variant={
              compositionExampleVariants[preview.composition] ?? "centered"
            }
            colors={styleExamplePalettes[currentStyleKey]}
          />
        ) : null}
      </div>
    </div>
  );
}

function PaletteSwatches({
  colors,
  className
}: {
  colors: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {colors.map((color) => (
        <span
          key={color}
          className="h-6 flex-1 rounded-sm border"
          style={{ backgroundColor: colorToHex(color) }}
          title={color}
        />
      ))}
    </div>
  );
}

function ArtworkExampleImage({
  variant,
  colors
}: {
  variant: StyleExampleVariant;
  colors: string[];
}) {
  const c0 = safeColor(colors, 0, "#efe7d8");
  const c1 = safeColor(colors, 1, "#cbbf9f");
  const c2 = safeColor(colors, 2, "#7d9271");
  const c3 = safeColor(colors, 3, "#2f3f35");

  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-md border"
      style={{
        background: `linear-gradient(160deg, ${c0}, ${c1})`
      }}
    >
      {variant === "japandi" ? (
        <>
          <span
            className="absolute left-[18%] top-[18%] size-16 rounded-full opacity-80"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute bottom-[24%] left-[10%] h-[34%] w-[52%]"
            style={{
              backgroundColor: c2,
              clipPath: "polygon(0 100%, 50% 0, 100% 100%)"
            }}
          />
          <span
            className="absolute bottom-[20%] right-[12%] h-[40%] w-[48%]"
            style={{
              backgroundColor: c3,
              clipPath: "polygon(0 100%, 55% 0, 100% 100%)"
            }}
          />
        </>
      ) : null}
      {variant === "botanical" ? (
        <>
          {[18, 34, 52, 68].map((left, index) => (
            <span
              key={left}
              className="absolute bottom-[14%] h-[62%] w-1 rounded-full"
              style={{
                left: `${left}%`,
                backgroundColor: c3,
                transform: `rotate(${index % 2 === 0 ? -8 : 8}deg)`
              }}
            />
          ))}
          {[22, 38, 56, 72].map((left, index) => (
            <span
              key={left}
              className="absolute h-10 w-6 rounded-full"
              style={{
                left: `${left}%`,
                top: `${26 + index * 8}%`,
                backgroundColor: index % 2 === 0 ? c2 : c1,
                transform: `rotate(${index % 2 === 0 ? 32 : -32}deg)`
              }}
            />
          ))}
        </>
      ) : null}
      {variant === "abstract" ? (
        <>
          <span
            className="absolute left-[-8%] top-[12%] h-28 w-32 rounded-[45%]"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute right-[-10%] top-[32%] h-36 w-36 rounded-full"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute bottom-[12%] left-[22%] h-24 w-28 rounded-[40%]"
            style={{ backgroundColor: c3 }}
          />
        </>
      ) : null}
      {variant === "nursery" ? (
        <>
          <span
            className="absolute left-[15%] top-[18%] h-24 w-32 rounded-full"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute right-[16%] top-[36%] size-20 rounded-full"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[18%] left-[28%] h-20 w-28 rounded-full"
            style={{ backgroundColor: c3 }}
          />
        </>
      ) : null}
      {variant === "vintage" ? (
        <>
          <span
            className="absolute inset-x-0 bottom-0 h-[42%]"
            style={{ backgroundColor: c3 }}
          />
          <span
            className="absolute bottom-[34%] left-[-8%] h-[24%] w-[70%] rounded-t-full"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[28%] right-[-12%] h-[30%] w-[78%] rounded-t-full"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute right-[18%] top-[18%] size-12 rounded-full"
            style={{ backgroundColor: c0 }}
          />
        </>
      ) : null}
      {variant === "geometry" ? (
        <IslamicGeometryExampleImage colors={[c0, c1, c2, c3]} />
      ) : null}
      {variant === "coastal" ? (
        <>
          <span
            className="absolute inset-x-0 bottom-0 h-[42%]"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[34%] left-[-10%] h-20 w-[120%] rounded-[50%]"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute bottom-[24%] left-[-16%] h-20 w-[125%] rounded-[50%]"
            style={{ backgroundColor: c3 }}
          />
        </>
      ) : null}
      {variant === "academia" ? (
        <>
          <span
            className="absolute inset-x-[18%] bottom-[18%] h-[16%] rounded-sm"
            style={{ backgroundColor: c3 }}
          />
          <span
            className="absolute bottom-[34%] left-[22%] h-[34%] w-[18%] rounded-t-full"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[34%] right-[22%] size-20 rounded-full"
            style={{ backgroundColor: c1 }}
          />
        </>
      ) : null}
    </div>
  );
}

function IslamicGeometryExampleImage({ colors }: { colors: string[] }) {
  const ground = safeColor(colors, 0, "#f4ead7");
  const emerald = safeColor(colors, 1, "#1f5138");
  const clay = safeColor(colors, 2, "#b26743");
  const indigo = safeColor(colors, 3, "#26364b");
  const tileCenters = [
    [60, 70],
    [120, 70],
    [180, 70],
    [60, 130],
    [120, 130],
    [180, 130],
    [60, 190],
    [120, 190],
    [180, 190],
    [60, 250],
    [120, 250],
    [180, 250]
  ];

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      viewBox="0 0 240 300"
    >
      <rect width="240" height="300" fill={ground} />
      <rect width="240" height="300" fill={emerald} opacity="0.04" />
      <rect
        x="20"
        y="20"
        width="200"
        height="260"
        fill="none"
        stroke={indigo}
        strokeWidth="3"
        opacity="0.78"
      />
      <rect
        x="30"
        y="30"
        width="180"
        height="240"
        fill="none"
        stroke={emerald}
        strokeWidth="1.8"
        opacity="0.9"
      />
      <g fill="none" stroke={indigo} strokeWidth="1.1" opacity="0.18">
        {[60, 120, 180].map((x) => (
          <path key={`v-${x}`} d={`M${x} 38V262`} />
        ))}
        {[70, 130, 190, 250].map((y) => (
          <path key={`h-${y}`} d={`M38 ${y}H202`} />
        ))}
      </g>
      <g>
        {tileCenters.map(([x, y], index) => {
          const fill = index % 2 === 0 ? emerald : clay;
          const accent = index % 2 === 0 ? clay : emerald;

          return (
            <g key={`${x}-${y}`}>
              <path
                d={`M${x} ${y - 24}L${x + 24} ${y}L${x} ${y + 24}L${
                  x - 24
                } ${y}Z`}
                fill={fill}
                opacity="0.2"
                stroke={indigo}
                strokeWidth="1.8"
              />
              <circle
                cx={x}
                cy={y}
                r="10"
                fill={ground}
                stroke={accent}
                strokeWidth="3"
              />
              <circle cx={x} cy={y} r="3.8" fill={indigo} opacity="0.82" />
            </g>
          );
        })}
      </g>
      <path
        d="M62 266C78 242 100 230 120 230s42 12 58 36"
        fill="none"
        stroke={clay}
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.9"
      />
      <path
        d="M68 40C82 58 101 67 120 67s38-9 52-27"
        fill="none"
        stroke={clay}
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.9"
      />
    </svg>
  );
}

function CompositionExampleImage({
  variant,
  colors
}: {
  variant: CompositionExampleVariant;
  colors: string[];
}) {
  const c0 = safeColor(colors, 0, "#efe7d8");
  const c1 = safeColor(colors, 1, "#cbbf9f");
  const c2 = safeColor(colors, 2, "#7d9271");
  const c3 = safeColor(colors, 3, "#2f3f35");

  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-md border"
      style={{ backgroundColor: c0 }}
    >
      {variant === "centered" ? (
        <span
          className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-[40%]"
          style={{ backgroundColor: c2 }}
        />
      ) : null}
      {variant === "landscape" ? (
        <>
          <span
            className="absolute inset-x-0 top-[45%] h-px"
            style={{ backgroundColor: c3 }}
          />
          <span
            className="absolute inset-x-0 bottom-0 h-[38%]"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[34%] left-[-10%] h-[20%] w-[75%] rounded-t-full"
            style={{ backgroundColor: c1 }}
          />
        </>
      ) : null}
      {variant === "full_bleed" ? (
        <>
          <span
            className="absolute left-[-16%] top-[-8%] h-40 w-40 rounded-full"
            style={{ backgroundColor: c1 }}
          />
          <span
            className="absolute right-[-20%] top-[26%] h-44 w-44 rounded-[44%]"
            style={{ backgroundColor: c2 }}
          />
          <span
            className="absolute bottom-[-10%] left-[18%] h-36 w-40 rounded-full"
            style={{ backgroundColor: c3 }}
          />
        </>
      ) : null}
      {variant === "minimal_edge" ? (
        <span
          className="absolute right-[18%] top-[24%] size-16 rounded-full"
          style={{ backgroundColor: c2 }}
        />
      ) : null}
      {variant === "symmetrical" ? (
        <>
          {[26, 50, 74].map((left) => (
            <span
              key={left}
              className="absolute top-[22%] size-10 -translate-x-1/2 rounded-full"
              style={{ left: `${left}%`, backgroundColor: c2 }}
            />
          ))}
          {[26, 50, 74].map((left) => (
            <span
              key={left}
              className="absolute bottom-[22%] size-10 -translate-x-1/2 rounded-full"
              style={{ left: `${left}%`, backgroundColor: c3 }}
            />
          ))}
        </>
      ) : null}
      <span className="absolute inset-[18%] rounded-sm border border-dashed border-black/20" />
    </div>
  );
}

function colorToHex(color: string) {
  return paletteColorHex[color] ?? color;
}

function safeColor(colors: string[], index: number, fallback: string) {
  return colors[index] ?? colors[index % colors.length] ?? fallback;
}

function GenerateCreditInfo({
  isFreePlan,
  previewCreditCost,
  freePreviewCreditsRemaining,
  freePreviewLimitReached
}: {
  isFreePlan: boolean;
  previewCreditCost: number;
  freePreviewCreditsRemaining: number | null;
  freePreviewLimitReached: boolean;
}) {
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
            <span className="text-muted-foreground">Generate 5 ratios</span>
            <Badge variant="secondary">{previewCreditCost} credits</Badge>
          </div>
          {isFreePlan ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Free credits left</span>
              <Badge
                variant={freePreviewLimitReached ? "warning" : "secondary"}
              >
                {freePreviewCreditsRemaining ?? 0} credits
              </Badge>
            </div>
          ) : null}
        </div>
        {isFreePlan ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Free includes {FREE_PLAN_ONE_TIME_PREVIEW_CREDITS} one-time preview
            credits.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Credits are reserved when work starts and refunded on technical
          failure.
        </p>
      </div>
    </details>
  );
}

function formatRatioKey(key: string) {
  return key.replace("x", ":");
}

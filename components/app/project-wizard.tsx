"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import type { ApiResponse } from "@/lib/api-response";
import type { DashboardSummary } from "@/lib/app/api-types";
import {
  FREE_PLAN_ONE_TIME_PREVIEW_CREDITS,
  FREE_PLAN_PREVIEWS_PER_BATCH,
  type PlanStatus
} from "@/lib/billing/plans";
import type { GenerationJobView } from "@/lib/jobs/generation-types";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  getDefaultPrintRatioKeys,
  getPrintRatioOrientation,
  PRINT_RATIO_PRESETS,
  type PrintOrientation,
  type PrintRatioPresetKey
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
  const activeRatioKeys = getDefaultPrintRatioKeys(selectedOrientation);
  const targetPixels = activeRatioKeys.map((key) => ({
    key,
    preset: PRINT_RATIO_PRESETS[key],
    pixels: presetKeyToPixels(key)
  }));
  const isFreePlan = planStatus?.planKey === "free";
  const previewCreditCost = FREE_PLAN_PREVIEWS_PER_BATCH;
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
    const payload = (await response.json()) as ApiResponse<GenerationJobView>;

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
        `You need ${previewCreditCost} credits to generate 2 previews.`
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
            previewCount: 2,
            quality: "draft"
          }
        : {
            projectName: input.packName,
            promptInputs: input,
            previewCount: 2,
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
      const payload =
        (await response.json()) as ApiResponse<QueueGenerationResponse>;

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
    const primaryRatio = getDefaultPrintRatioKeys(orientation)[0];

    setInput((current) => ({
      ...current,
      primaryRatio
    }));
  }

  function handlePrimaryRatioChange(primaryRatio: PrintRatioPresetKey) {
    setInput((current) => ({
      ...current,
      primaryRatio
    }));
  }

  return (
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
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:bg-secondary",
                      input.paletteKey === palette.key &&
                        "border-primary bg-secondary"
                    )}
                  >
                    <p className="font-medium">{palette.label}</p>
                    <div className="mt-3 flex gap-2">
                      {palette.colors.map((color) => (
                        <span
                          key={color}
                          className="h-6 flex-1 rounded-sm border bg-secondary"
                          title={color}
                        />
                      ))}
                    </div>
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
                    For multi-ratio Etsy packs, keep important details away from
                    edges.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {targetPixels.map((target) => (
                  <button
                    key={target.key}
                    type="button"
                    aria-pressed={input.primaryRatio === target.key}
                    onClick={() => handlePrimaryRatioChange(target.key)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition hover:bg-secondary",
                      input.primaryRatio === target.key &&
                        "border-primary bg-secondary"
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">{target.preset.label}</span>
                      {input.primaryRatio === target.key ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </span>
                    <p className="mt-1 font-mono text-sm text-muted-foreground">
                      {target.pixels.width} x {target.pixels.height} px
                    </p>
                  </button>
                ))}
              </div>
              {isFreePlan ? (
                <div className="rounded-lg border bg-secondary/50 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">Free preview credits</p>
                    <Badge
                      variant={
                        freePreviewLimitReached ? "warning" : "secondary"
                      }
                    >
                      {freePreviewCreditsRemaining ?? 0} credits left
                    </Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Free includes {FREE_PLAN_ONE_TIME_PREVIEW_CREDITS} one-time
                    preview credits. Generating 2 previews uses{" "}
                    {previewCreditCost} credits.
                  </p>
                </div>
              ) : null}
              <Textarea
                readOnly
                value={result.ok ? result.built.prompt : result.message}
                className="min-h-72 font-mono text-xs"
              />
              {!result.ok ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                  <p className="font-medium">Prompt blocked</p>
                  <p className="mt-2 text-muted-foreground">{result.message}</p>
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
                      <p className="font-medium">Preview generation</p>
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
                  setStep((current) => Math.min(current + 1, steps.length - 1))
                }
              >
                Next
                <ChevronRight />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  !result.ok || isGenerationRunning || freePreviewLimitReached
                }
                onClick={handleGenerate}
              >
                {isGenerationRunning ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {isGenerationRunning
                  ? "Generating previews"
                  : freePreviewLimitReached
                    ? "Not enough credits"
                    : "Generate 2 previews"}
              </Button>
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
              label="Primary ratio"
              value={PRINT_RATIO_PRESETS[input.primaryRatio].label}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary">2 previews</Badge>
              {isFreePlan ? (
                <Badge variant="secondary">
                  {freePreviewCreditsRemaining ?? 0} free credits left
                </Badge>
              ) : (
                <Badge variant="secondary">2 credits</Badge>
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
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

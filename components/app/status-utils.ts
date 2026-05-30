import type { BadgeProps } from "@/components/ui/badge";
import type { FirestoreProject } from "@/lib/firestore/projects";
import type { ExportJobView } from "@/lib/jobs/export-types";
import type { GenerationJobView } from "@/lib/jobs/generation-types";
import type { MockupJobView } from "@/lib/jobs/mockup-types";

export function projectStatusVariant(
  status: FirestoreProject["status"]
): BadgeProps["variant"] {
  if (status === "ready") {
    return "default";
  }

  if (status === "failed") {
    return "warning";
  }

  return "outline";
}

export function generationStatusVariant(
  status: GenerationJobView["status"]
): BadgeProps["variant"] {
  if (status === "succeeded") {
    return "default";
  }

  if (status === "failed" || status === "cancelled") {
    return "warning";
  }

  return "secondary";
}

export function exportStatusVariant(
  status: ExportJobView["status"]
): BadgeProps["variant"] {
  if (status === "succeeded") {
    return "default";
  }

  if (status === "failed" || status === "cancelled") {
    return "warning";
  }

  return "secondary";
}

export function mockupStatusVariant(
  status: MockupJobView["status"]
): BadgeProps["variant"] {
  if (status === "succeeded") {
    return "default";
  }

  if (status === "failed" || status === "cancelled") {
    return "warning";
  }

  return "secondary";
}

export function formatAppDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

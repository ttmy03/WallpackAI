import type { PlanStatus } from "@/lib/billing/plans";
import type { FirestoreProject, ProjectCard } from "@/lib/firestore/projects";
import type {
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";
import type { ExportJobView } from "@/lib/jobs/export-types";

export type DashboardSummary = {
  plan: PlanStatus;
  creditBalance: number;
  recentProjects: ProjectCard[];
  recentGenerationJobs: GenerationJobView[];
  jobsNeedingAction: number;
  recentExportsCount: number;
};

export type ProjectDetail = {
  plan: PlanStatus;
  project: FirestoreProject;
  generationJobs: GenerationJobView[];
  latestGenerationJob: GenerationJobView | null;
  exportJobs: ExportJobView[];
  latestExportJob: ExportJobView | null;
  artworks: GeneratedArtworkPreview[];
};

export type UserSettings = {
  email: string | null;
  name: string | null;
  defaultAiDisclosure: boolean;
};

export type RetryGenerationResponse = {
  jobId: string;
  status: GenerationJobView["status"];
  projectId: string;
};

export type ExportJobResponse = {
  jobId: string;
  status: ExportJobView["status"];
  projectId: string;
};

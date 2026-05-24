import type { FirestoreProject, ProjectCard } from "@/lib/firestore/projects";
import type {
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";

export type DashboardSummary = {
  creditBalance: number;
  recentProjects: ProjectCard[];
  recentGenerationJobs: GenerationJobView[];
  jobsNeedingAction: number;
  recentExportsCount: number;
};

export type ProjectDetail = {
  project: FirestoreProject;
  generationJobs: GenerationJobView[];
  latestGenerationJob: GenerationJobView | null;
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

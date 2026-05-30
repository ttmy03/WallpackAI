import type { PlanStatus } from "@/lib/billing/plans";
import type { FirestoreProject } from "@/lib/firestore/projects";
import type {
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";
import type { ExportJobView } from "@/lib/jobs/export-types";
import type { MockupJobView } from "@/lib/jobs/mockup-types";

export type DashboardSummary = {
  plan: PlanStatus;
  creditBalance: number;
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
  mockupJobs: MockupJobView[];
  latestMockupJob: MockupJobView | null;
  latestMockupPackJob: MockupJobView | null;
  artworks: GeneratedArtworkPreview[];
};

export type UserSettings = {
  email: string | null;
  name: string | null;
  planKey: PlanStatus["planKey"];
  planLabel: string;
  creditBalance: number;
  hasStripeCustomer: boolean;
  defaultAiDisclosure: boolean;
};

export type BillingPortalResponse = {
  url: string;
};

export type BillingCheckoutResponse = {
  url: string;
};

export type DeleteAccountResponse = {
  deleted: true;
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

export type MockupJobResponse = {
  jobId: string;
  status: MockupJobView["status"];
  projectId: string;
};

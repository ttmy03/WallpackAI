import { AlertCircle, ArrowRight, Clock3, Copy, Download } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

const projects = [
  {
    id: "demo-japandi",
    name: "Japandi Mountain Set",
    status: "draft",
    ratios: "2:3, 3:4, 4:5",
    updated: "2 hours ago"
  },
  {
    id: "demo-botanical",
    name: "Boho Botanical Trio",
    status: "ready",
    ratios: "5-ratio pack",
    updated: "Yesterday"
  }
];

const jobs = [
  {
    label: "Export pack",
    status: "failed",
    detail: "One mockup exceeded Etsy upload target"
  },
  {
    label: "Preview generation",
    status: "succeeded",
    detail: "2 previews ready for selection"
  }
];

export default function DashboardPage() {
  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Etsy wall-art workspace
          </h1>
        </div>
        <Button asChild>
          <Link href="/app/new">
            New Wall Art Pack <ArrowRight />
          </Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Credit balance</CardDescription>
            <CardTitle className="text-3xl">24</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Generation/export debit is handled through an idempotent ledger.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Recent exports</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              3 <Download className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Signed URLs and storage adapter are planned for the export step.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Jobs needing action</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              1 <AlertCircle className="size-5 text-accent" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Failed jobs must show error state, refund status, and retry.
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <CardDescription>
              Draft packs stay focused on ratios, listing assets, and Etsy file
              limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}/editor`}
                className="grid gap-3 rounded-md border p-4 transition hover:bg-secondary sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.ratios} · {project.updated}
                  </p>
                </div>
                <Badge variant={project.status === "ready" ? "default" : "outline"}>
                  {project.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job status</CardTitle>
            <CardDescription>
              Workers will update durable stages instead of blocking routes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {jobs.map((job) => (
              <div key={job.label} className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{job.label}</p>
                  <Badge
                    variant={job.status === "failed" ? "warning" : "secondary"}
                  >
                    {job.status}
                  </Badge>
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="size-4" />
                  {job.detail}
                </p>
              </div>
            ))}
            <Button variant="outline" className="justify-start">
              <Copy />
              Duplicate last successful pack
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const projects = [
  {
    id: "demo-japandi",
    name: "Japandi Mountain Set",
    status: "draft",
    style: "Japandi Minimal",
    updated: "2 hours ago"
  },
  {
    id: "demo-botanical",
    name: "Boho Botanical Trio",
    status: "ready",
    style: "Boho Botanical",
    updated: "Yesterday"
  }
];

export default function ProjectsPage() {
  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Wall-art packs
          </h1>
        </div>
        <Button asChild>
          <Link href="/app/new">New pack</Link>
        </Button>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Style</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/app/projects/${project.id}/editor`}
                    className="font-medium text-primary hover:underline"
                  >
                    {project.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{project.style}</td>
                <td className="px-4 py-3">
                  <Badge variant={project.status === "ready" ? "default" : "outline"}>
                    {project.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {project.updated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

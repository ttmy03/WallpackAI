import { ProjectWizard } from "@/components/app/project-wizard";

export default function NewProjectPage() {
  return (
    <main>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
          New pack
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          Create an Etsy-ready wall-art pack
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Start with seller-safe presets, then generate previews through a job
          flow. Protected brands, characters, celebrities, logos, and living
          artist mimicry are blocked before credits are used.
        </p>
      </div>
      <ProjectWizard />
    </main>
  );
}

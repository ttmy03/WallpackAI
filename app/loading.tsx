import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <BrandLogo variant="mark" size="sm" decorative />
        <div className="h-8 w-52 animate-pulse rounded-md bg-secondary" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-lg bg-secondary" />
        <div className="h-32 animate-pulse rounded-lg bg-secondary" />
        <div className="h-32 animate-pulse rounded-lg bg-secondary" />
      </div>
    </main>
  );
}

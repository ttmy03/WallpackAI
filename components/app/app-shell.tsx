import {
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Plus,
  Settings
} from "lucide-react";
import Link from "next/link";

import { AuthGate } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/new", label: "New pack", icon: Plus },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/help/print-sizes", label: "Print sizes", icon: HelpCircle },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

const mobileNavItems = navItems.filter((item) => item.href !== "/app/new");

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="sticky top-16 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
        <details className="group mx-auto max-w-7xl">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-secondary [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Menu className="size-4" />
              App menu
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              Open
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              Close
            </span>
          </summary>
          <div className="mt-3 grid gap-3 rounded-md border bg-card p-3 shadow-sm">
            <Button asChild className="w-full justify-start">
              <Link href="/app/new">
                <Plus />
                New Wall Art Pack
              </Link>
            </Button>
            <nav className="grid gap-1" aria-label="Mobile app navigation">
              {mobileNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </div>
      <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
        <aside className="hidden border-r py-6 pr-5 lg:block">
          <Button asChild className="w-full justify-start">
            <Link href="/app/new">
              <Plus />
              New Wall Art Pack
            </Link>
          </Button>
          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 py-6 lg:pl-8">
          <AuthGate>{children}</AuthGate>
        </div>
      </div>
    </div>
  );
}

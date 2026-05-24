import {
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Plus,
  Settings
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/new", label: "New pack", icon: Plus },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/help/print-sizes", label: "Print sizes", icon: HelpCircle },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
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
        <div className="min-w-0 py-6 lg:pl-8">{children}</div>
      </div>
    </div>
  );
}

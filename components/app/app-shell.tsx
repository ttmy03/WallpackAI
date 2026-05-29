import { Plus } from "lucide-react";
import Link from "next/link";

import { DesktopAppNav } from "@/components/app/desktop-app-nav";
import { MobileAppMenu } from "@/components/app/mobile-app-menu";
import { AuthGate } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <MobileAppMenu />
      <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
        <aside className="hidden border-r py-6 pr-5 lg:block">
          <Button asChild className="w-full justify-start">
            <Link href="/app/new">
              <Plus />
              New Wall Art Pack
            </Link>
          </Button>
          <DesktopAppNav />
        </aside>
        <div className="min-w-0 py-6 lg:pl-8">
          <AuthGate>{children}</AuthGate>
        </div>
      </div>
    </div>
  );
}

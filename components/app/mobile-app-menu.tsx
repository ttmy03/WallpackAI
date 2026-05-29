"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  getActiveAppNavHref,
  mobileAppNavItems
} from "@/components/app/app-nav-items";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileAppMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = getActiveAppNavHref(pathname, mobileAppNavItems);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="sticky top-16 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
      <details
        className="group mx-auto max-w-7xl"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
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
            <Link href="/app/new" onClick={closeMenu}>
              <Plus />
              New Wall Art Pack
            </Link>
          </Button>
          <nav className="grid gap-1" aria-label="Mobile app navigation">
            {mobileAppNavItems.map((item) => {
              const isActive = item.href === activeHref;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={closeMenu}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                    isActive && "bg-secondary text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </details>
    </div>
  );
}

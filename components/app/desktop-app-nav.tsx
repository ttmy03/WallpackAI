"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  appNavItems,
  getActiveAppNavHref
} from "@/components/app/app-nav-items";
import { cn } from "@/lib/utils";

export function DesktopAppNav() {
  const pathname = usePathname();
  const activeHref = getActiveAppNavHref(pathname);

  return (
    <nav className="mt-6 grid gap-1" aria-label="App navigation">
      {appNavItems.map((item) => {
        const isActive = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground",
              isActive && "bg-secondary text-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

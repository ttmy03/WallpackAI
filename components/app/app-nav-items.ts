import {
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Plus,
  Settings,
  type LucideIcon
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const appNavItems: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/new", label: "New pack", icon: Plus },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/help/print-sizes", label: "Print sizes", icon: HelpCircle },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export const mobileAppNavItems = appNavItems.filter(
  (item) => item.href !== "/app/new"
);

export function getActiveAppNavHref(
  pathname: string,
  items: AppNavItem[] = appNavItems
) {
  const matches = items.filter(
    (item) =>
      pathname === item.href ||
      (item.href !== "/app" && pathname.startsWith(`${item.href}/`))
  );

  return matches.sort((first, second) => second.href.length - first.href.length)
    .at(0)?.href;
}

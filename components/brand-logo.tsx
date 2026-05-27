import { cn } from "@/lib/utils";

type BrandLogoVariant = "lockup" | "mark";
type BrandLogoSize = "sm" | "md" | "lg";
type BrandLogoTone = "default" | "inverse";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  tone?: BrandLogoTone;
  className?: string;
  label?: string;
  decorative?: boolean;
};

const sizeClasses: Record<
  BrandLogoSize,
  {
    root: string;
    mark: string;
    wordmark: string;
  }
> = {
  sm: {
    root: "gap-2",
    mark: "size-8",
    wordmark: "text-sm"
  },
  md: {
    root: "gap-2.5",
    mark: "size-9",
    wordmark: "text-base"
  },
  lg: {
    root: "gap-3",
    mark: "size-11",
    wordmark: "text-xl sm:text-2xl"
  }
};

const toneClasses: Record<BrandLogoTone, string> = {
  default: "text-foreground",
  inverse: "text-white"
};

export function BrandLogo({
  variant = "lockup",
  size = "md",
  tone = "default",
  className,
  label = "WallPack AI",
  decorative = false
}: BrandLogoProps) {
  const classes = sizeClasses[size];

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "inline-flex min-w-0 select-none items-center align-middle",
        classes.root,
        toneClasses[tone],
        className
      )}
    >
      <WallPackMark className={classes.mark} tone={tone} />
      {variant === "lockup" ? (
        <span
          className={cn(
            "min-w-0 whitespace-nowrap font-semibold tracking-normal leading-none",
            classes.wordmark
          )}
        >
          <span>WallPack</span>
          <span className="text-accent"> AI</span>
        </span>
      ) : null}
    </span>
  );
}

function WallPackMark({
  className,
  tone
}: {
  className: string;
  tone: BrandLogoTone;
}) {
  const surface = tone === "inverse" ? "#f8f7f4" : "var(--primary)";
  const mountain =
    tone === "inverse" ? "var(--primary)" : "var(--primary-foreground)";

  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="10" fill={surface} />
      <circle cx="27" cy="11.8" r="2.2" fill="var(--accent)" />
      <path
        d="M8.6 29.5c3.1-5.2 5.8-9.8 8.6-13.8.7-1 2.1-1 2.8 0 2.9 4.1 5.8 8.8 8.8 13.8z"
        fill={mountain}
      />
      <path
        d="M18.9 29.5c2.4-4 4.7-7.8 7-10.8.7-.9 2-.9 2.7 0 2.3 3.1 4.4 6.8 6.8 10.8z"
        fill={mountain}
      />
    </svg>
  );
}

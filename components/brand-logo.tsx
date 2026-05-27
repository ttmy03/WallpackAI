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
  const sheet =
    tone === "inverse" ? "var(--primary)" : "var(--primary-foreground)";
  const mountain = tone === "inverse" ? "#f8f7f4" : "var(--primary)";

  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="10" fill={surface} />
      <rect
        x="9"
        y="12"
        width="11"
        height="17"
        rx="2"
        fill={sheet}
        opacity="0.7"
      />
      <rect x="15" y="8" width="16" height="23" rx="2.5" fill={sheet} />
      <circle cx="25.9" cy="13.8" r="1.7" fill="var(--accent)" />
      <path d="M18.2 26.6 22 18.7l3.7 7.9z" fill={mountain} />
      <path d="M22.7 26.6 26.2 20.2l3.6 6.4z" fill={mountain} />
    </svg>
  );
}

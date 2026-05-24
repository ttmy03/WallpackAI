import { z } from "zod";

import type { PrintRatioPresetKey } from "@/lib/print/presets";

export const AI_DISCLOSURE_SENTENCE =
  "This design was created with AI-assisted tools and finished as a digital printable artwork.";

export const listingCopySchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1).max(20)).max(13),
  aiDisclosureIncluded: z.boolean()
});

export type ListingCopy = z.infer<typeof listingCopySchema>;

export function createListingCopy(input: {
  subject: string;
  styleLabel: string;
  ratios: PrintRatioPresetKey[];
  includeAiDisclosure?: boolean;
}): ListingCopy {
  const includeAiDisclosure = input.includeAiDisclosure ?? true;
  const ratioText = input.ratios.join(", ");
  const title = `${titleCase(input.subject)} Printable Wall Art, ${input.styleLabel} Digital Download`.slice(
    0,
    140
  );
  const tags = buildTags(input.subject, input.styleLabel);
  const disclosure = includeAiDisclosure ? `\n\nAI disclosure: ${AI_DISCLOSURE_SENTENCE}` : "";

  return listingCopySchema.parse({
    title,
    tags,
    aiDisclosureIncluded: includeAiDisclosure,
    description: [
      `${title}`,
      "",
      "Digital download only. No physical item will be shipped.",
      `Included print ratios: ${ratioText}. Use the matching JPG file for your frame size.`,
      "Colors may vary slightly between screens, printers, papers, and local print shops.",
      disclosure.trim()
    ]
      .filter(Boolean)
      .join("\n")
  });
}

function buildTags(subject: string, styleLabel: string) {
  const rawTags = [
    "printable art",
    "digital download",
    "wall art",
    "etsy print",
    "poster print",
    "home decor",
    "printable poster",
    "gallery wall",
    "instant download",
    ...subject.split(/\s+/),
    ...styleLabel.split(/\s+/)
  ];

  return [...new Set(rawTags.map((tag) => tag.toLowerCase()))]
    .map((tag) => tag.replace(/[^a-z0-9 ]+/g, "").trim())
    .filter((tag) => tag.length > 0 && tag.length <= 20)
    .slice(0, 13);
}

function titleCase(input: string) {
  return input
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

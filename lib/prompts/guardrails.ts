import type { PromptInput } from "@/lib/prompts/schema";

export type PromptBlockCategory =
  | "protected_brand_or_franchise"
  | "celebrity_or_public_figure"
  | "living_artist_style"
  | "logo_or_brand_mark"
  | "prompt_bundle";

export type PromptGuardResult =
  | { ok: true; normalizedText: string }
  | {
      ok: false;
      code: "PROMPT_BLOCKED";
      category: PromptBlockCategory;
      message: string;
      matchedTerms: string[];
      suggestion: string;
    };

const blockRules: Array<{
  category: PromptBlockCategory;
  terms: RegExp[];
  suggestion: string;
}> = [
  {
    category: "protected_brand_or_franchise",
    terms: [
      /\bdisney\b/i,
      /\bpixar\b/i,
      /\bmarvel\b/i,
      /\bdc comics?\b/i,
      /\bstar wars\b/i,
      /\bpokemon\b/i,
      /\bpokémon\b/i,
      /\bnintendo\b/i,
      /\bharry potter\b/i,
      /\bbarbie\b/i,
      /\bmickey mouse\b/i
    ],
    suggestion:
      "Use a generic visual direction such as fairytale-inspired, whimsical animation-inspired, or heroic comic-inspired decor."
  },
  {
    category: "logo_or_brand_mark",
    terms: [
      /\blogo\b/i,
      /\bbrand mark\b/i,
      /\btrademark\b/i,
      /\bnike\b/i,
      /\badidas\b/i,
      /\bapple logo\b/i,
      /\bgucci\b/i,
      /\bchanel\b/i,
      /\blouis vuitton\b/i
    ],
    suggestion:
      "Describe the mood, colors, materials, or pattern style without asking for a logo or brand identifier."
  },
  {
    category: "celebrity_or_public_figure",
    terms: [
      /\btaylor swift\b/i,
      /\bbeyonce\b/i,
      /\bbeyoncé\b/i,
      /\belon musk\b/i,
      /\bkim kardashian\b/i,
      /\bcristiano ronaldo\b/i,
      /\blionel messi\b/i
    ],
    suggestion:
      "Use a generic subject such as pop-star-inspired stage energy or athletic portrait-inspired composition without naming a real person."
  },
  {
    category: "living_artist_style",
    terms: [
      /\bin the style of\s+(banksy|yayoi kusama|jeff koons|takashi murakami|damien hirst)\b/i,
      /\b(banksy|yayoi kusama|jeff koons|takashi murakami|damien hirst)\s+style\b/i
    ],
    suggestion:
      "Use a generic style description such as street-art inspired stencil aesthetic or colorful dotted abstract pattern."
  },
  {
    category: "prompt_bundle",
    terms: [/\bprompt bundle\b/i, /\bmidjourney prompts?\b/i],
    suggestion:
      "Create a finished printable wall-art product instead of a prompt resale product."
  }
];

export function guardPromptInput(input: PromptInput): PromptGuardResult {
  const normalizedText = normalizePromptText(
    [
      input.packName,
      input.subject,
      input.niche,
      input.room,
      input.customPalette,
      input.mood,
      input.composition,
      ...input.avoid
    ]
      .filter(Boolean)
      .join(" ")
  );

  for (const rule of blockRules) {
    const matchedTerms = rule.terms
      .filter((term) => term.test(normalizedText))
      .map((term) => readablePattern(term));

    if (matchedTerms.length > 0) {
      return {
        ok: false,
        code: "PROMPT_BLOCKED",
        category: rule.category,
        message:
          "This prompt mentions a protected brand, character, artist, public figure, logo, or unsupported prompt product.",
        matchedTerms,
        suggestion: rule.suggestion
      };
    }
  }

  return { ok: true, normalizedText };
}

function normalizePromptText(input: string) {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function readablePattern(pattern: RegExp) {
  return pattern.source
    .replaceAll("\\b", "")
    .replaceAll("\\s+", " ")
    .replaceAll("\\", "")
    .replaceAll("?", "")
    .replaceAll("i", "")
    .replace(/^\(|\)$/g, "");
}

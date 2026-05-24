const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);

export function sanitizeFilename(input: string, fallback = "wallpack-file") {
  const normalized = input
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .slice(0, 120);

  const safe = normalized.length > 0 ? normalized : fallback;
  const baseName = safe.split(".")[0]?.toLowerCase() ?? safe.toLowerCase();

  if (RESERVED_WINDOWS_NAMES.has(baseName)) {
    return `${safe}-file`;
  }

  return safe;
}

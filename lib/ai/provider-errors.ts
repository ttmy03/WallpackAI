export const IMAGE_PROVIDER_INSUFFICIENT_CREDITS =
  "IMAGE_PROVIDER_INSUFFICIENT_CREDITS";

export function isImageProviderInsufficientCreditsError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("insufficient credits") &&
    (message.includes("runware") || message.includes("image request failed"))
  );
}

export function imageProviderInsufficientCreditsMessage(action: string) {
  return `${action} is temporarily unavailable because the connected AI provider needs account credits. Your WallPack credits were refunded. Please retry after support resolves this.`;
}

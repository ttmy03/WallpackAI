const fallbackRedirectPath = "/app";

export function getSafeEmailActionRedirect(
  continueUrl: string | null,
  currentOrigin: string
) {
  if (!continueUrl) {
    return fallbackRedirectPath;
  }

  try {
    const parsedUrl = new URL(continueUrl, currentOrigin);
    const currentUrl = new URL(currentOrigin);

    if (parsedUrl.origin !== currentUrl.origin) {
      return fallbackRedirectPath;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return fallbackRedirectPath;
  }
}

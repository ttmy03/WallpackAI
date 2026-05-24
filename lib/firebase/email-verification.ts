import type { ActionCodeSettings } from "firebase/auth";

type PublicAppEnv = {
  NEXT_PUBLIC_APP_URL?: string;
};

const verificationReturnPath = "/app";

export function getEmailVerificationActionCodeSettings(
  currentOrigin: string,
  env: PublicAppEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  }
): ActionCodeSettings {
  return {
    url: getEmailVerificationContinueUrl(currentOrigin, env),
    handleCodeInApp: false
  };
}

export function getEmailVerificationContinueUrl(
  currentOrigin: string,
  env: PublicAppEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  }
) {
  const configuredAppUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl =
    configuredAppUrl && configuredAppUrl.length > 0
      ? configuredAppUrl
      : currentOrigin;

  return new URL(verificationReturnPath, baseUrl).toString();
}

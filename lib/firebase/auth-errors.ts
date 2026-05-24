export function getFriendlyFirebaseAuthError(error: unknown) {
  const code = getFirebaseAuthErrorCode(error);

  switch (code) {
    case "auth/email-already-in-use":
      return "This email already has an account.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled in Firebase Authentication.";
    case "auth/admin-restricted-operation":
      return "Firebase Auth sign-ups are restricted for this project.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Authentication.";
    case "auth/unauthorized-continue-uri":
      return "The email verification return URL is not authorized in Firebase Authentication.";
    case "auth/invalid-continue-uri":
      return "The email verification return URL is invalid.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "The Firebase web API key is not valid for this app.";
    case "auth/network-request-failed":
      return "Firebase could not be reached. Check the network connection and try again.";
    case "auth/too-many-requests":
      return "Firebase temporarily blocked this request. Try again later.";
    default:
      if (isMissingFirebaseClientEnvError(error)) {
        return "Firebase client config is missing. Restart the dev server after changing .env.";
      }

      return code
        ? `Firebase could not complete this request (${code}).`
        : "Firebase could not complete this request.";
  }
}

function getFirebaseAuthErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null;
}

function isMissingFirebaseClientEnvError(error: unknown) {
  return (
    error instanceof Error &&
    /^NEXT_PUBLIC_FIREBASE_[A-Z_]+ is required to initialize Firebase$/.test(
      error.message
    )
  );
}

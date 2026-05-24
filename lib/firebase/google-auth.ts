export const GOOGLE_FIREBASE_PROVIDER_ID = "google.com";

type FirebaseProviderIdentity = {
  providerId?: string | null;
};

export function hasGoogleProvider(
  providerData: readonly FirebaseProviderIdentity[]
) {
  return providerData.some(
    (provider) => provider.providerId === GOOGLE_FIREBASE_PROVIDER_ID
  );
}

export function isGoogleSignInProvider(providerId: string | null) {
  return providerId === GOOGLE_FIREBASE_PROVIDER_ID;
}

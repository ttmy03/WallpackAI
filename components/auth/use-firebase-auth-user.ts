"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

type FirebaseAuthUserState =
  | { status: "loading" }
  | { status: "ready"; user: User | null }
  | { status: "error"; message: string };

export function useFirebaseAuthUser() {
  const [state, setState] = useState<FirebaseAuthUserState>({
    status: "loading"
  });

  useEffect(() => {
    let cancelled = false;

    try {
      const auth = getFirebaseClientAuth();

      return onAuthStateChanged(
        auth,
        (user) => setState({ status: "ready", user }),
        (error) =>
          setState({
            status: "error",
            message: getFriendlyFirebaseAuthError(error)
          })
      );
    } catch (error) {
      queueMicrotask(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: getFriendlyFirebaseAuthError(error)
          });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    const auth = getFirebaseClientAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setState({ status: "ready", user: null });
      return;
    }

    await currentUser.reload();
    await currentUser.getIdToken(true);
    setState({ status: "ready", user: auth.currentUser });
  }, []);

  return { state, refreshUser };
}

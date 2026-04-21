"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";

const DEDUPE_KEY = "signed_up_tracked";
const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

export function SignedUpTracker() {
  const { isLoaded, isSignedIn, user } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !posthog) return;
    if (typeof window === "undefined") return;

    if (localStorage.getItem(DEDUPE_KEY)) return;

    const createdAt = user.createdAt ? new Date(user.createdAt) : null;
    if (!createdAt) return;
    if (Date.now() - createdAt.getTime() > NEW_USER_WINDOW_MS) return;

    posthog.capture("signed_up", {
      plan: "free",
      signup_date: createdAt.toISOString(),
    });

    localStorage.setItem(DEDUPE_KEY, "1");
  }, [isLoaded, isSignedIn, user, posthog]);

  return null;
}

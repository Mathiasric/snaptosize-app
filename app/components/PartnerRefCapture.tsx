"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const STORAGE_KEY_REF = "partner_ref";
const STORAGE_KEY_SOURCE = "partner_source";

export function PartnerRefCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    const source = searchParams.get("source");

    // Use URL params if present, otherwise fall back to localStorage
    const partnerRef = ref || localStorage.getItem(STORAGE_KEY_REF);
    const partnerSource = source || localStorage.getItem(STORAGE_KEY_SOURCE);

    if (!partnerRef && !partnerSource) return;

    // Persist to localStorage for returning visitors
    if (partnerRef) localStorage.setItem(STORAGE_KEY_REF, partnerRef);
    if (partnerSource) localStorage.setItem(STORAGE_KEY_SOURCE, partnerSource);

    // Register as super properties (attached to all future events)
    const superProps: Record<string, string> = {};
    if (partnerRef) superProps.partner_ref = partnerRef;
    if (partnerSource) superProps.partner_source = partnerSource;
    posthog.register(superProps);

    // Set as permanent person properties
    posthog.setPersonProperties(superProps);

    // Clean URL params for better UX
    if (ref || source) {
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      url.searchParams.delete("source");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  return null;
}

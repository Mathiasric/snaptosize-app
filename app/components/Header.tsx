"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/nextjs";

function PlanIndicator() {
  const { user, isLoaded } = useUser();
  const plan = (user?.publicMetadata as { plan?: string } | undefined)?.plan;
  if (!isLoaded) return null;
  if (plan === "pro") {
    return (
      <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-light">
        Pro
      </span>
    );
  }
  return (
    <Link
      href="/app/billing?source=nav"
      className="gradient-btn rounded-full px-4 py-1.5 text-xs font-semibold text-white"
    >
      Upgrade
    </Link>
  );
}

export function Header() {
  const { signOut } = useClerk();

  // Override Clerk's __unstable__onBeforeSetActive to prevent server action
  // POST to static pages (causes 405 on Cloudflare Pages).
  // Clerk sets this in useLayoutEffect; our useEffect runs after, overriding it.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__unstable__onBeforeSetActive = () => Promise.resolve();
  }, []);

  const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void signOut({ redirectUrl: "/" });
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/favicon-96x96.png"
          alt="SnapToSize"
          width={28}
          height={28}
          className="rounded"
        />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          SnapToSize
        </span>
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        <SignedOut>
          <Link
            href="/login"
            className="text-foreground/60 transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-4 py-1.5 text-white transition-colors hover:bg-accent-light"
          >
            Sign up
          </Link>
        </SignedOut>

        <SignedIn>
          <PlanIndicator />
          <Link
            href="/app/billing"
            className="text-foreground/60 transition-colors hover:text-accent-light"
          >
            Billing
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground/60 transition-colors hover:border-accent/40 hover:text-foreground"
          >
            Sign out
          </button>
        </SignedIn>
      </nav>
    </header>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { CreditCard } from "lucide-react";
import { useQuota } from "../app/context/QuotaContext";

function QuotaBadge() {
  const { remaining } = useQuota();
  const { user, isLoaded } = useUser();
  const plan = (user?.publicMetadata as { plan?: string } | undefined)?.plan;

  // Only show for signed-in free users who have quota data
  if (!isLoaded || plan === "pro" || !remaining) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-foreground/40">
      <span>{remaining.batch} packs</span>
      <span className="text-foreground/15">|</span>
      <span>{remaining.quick} exports</span>
      <span className="text-foreground/25">left today</span>
    </div>
  );
}

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
  // Override Clerk's __unstable__onBeforeSetActive to prevent server action
  // POST to static pages (causes 405 on Cloudflare Pages).
  // Clerk sets this in useLayoutEffect; our useEffect runs after, overriding it.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__unstable__onBeforeSetActive = () => Promise.resolve();
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/logo-96.png"
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
          <QuotaBadge />
          <PlanIndicator />
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 ring-1 ring-border hover:ring-accent/50 transition-all",
                userButtonPopoverCard: "bg-surface border border-border shadow-xl rounded-xl",
                userButtonPopoverActionButton:
                  "text-foreground/70 hover:text-foreground hover:bg-surface/80",
                userButtonPopoverActionButtonText: "text-sm",
                userButtonPopoverFooter: "hidden",
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link
                label="Billing"
                labelIcon={<CreditCard size={14} />}
                href="/app/billing"
              />
            </UserButton.MenuItems>
          </UserButton>
        </SignedIn>
      </nav>
    </header>
  );
}

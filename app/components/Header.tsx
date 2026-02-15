"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignOutButton } from "@clerk/nextjs";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        SnapToSize
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        <SignedOut>
          <Link
            href="/login"
            className="text-foreground/70 transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-4 py-1.5 text-background transition-colors hover:bg-foreground/80"
          >
            Sign up
          </Link>
        </SignedOut>

        <SignedIn>
          <Link
            href="/app"
            className="text-foreground/70 transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          <SignOutButton>
            <button className="rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">
              Sign out
            </button>
          </SignOutButton>
        </SignedIn>
      </nav>
    </header>
  );
}

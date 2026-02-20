"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, SignOutButton } from "@clerk/nextjs";

export function Header() {
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
          <Link
            href="/app"
            className="text-foreground/60 transition-colors hover:text-accent-light"
          >
            Dashboard
          </Link>
          <SignOutButton>
            <button className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground/60 transition-colors hover:border-accent/40 hover:text-foreground">
              Sign out
            </button>
          </SignOutButton>
        </SignedIn>
      </nav>
    </header>
  );
}

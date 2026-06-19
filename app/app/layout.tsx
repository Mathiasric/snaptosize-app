"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Crop, Zap, FolderHeart } from "lucide-react";

// Order is deliberate: lead with the proven hero (Size Packs = 71% of exports),
// then Perfect Fit adjacent so the Fill-vs-Frame distinction reads by proximity
// (keep your whole image vs. frame it to a new shape), then the two utilities.
const MODES = [
  { href: "/app/packs", label: "Size Packs", icon: Layers, pro: false, isNew: false, hero: true },
  { href: "/app/perfect-fit", label: "Perfect Fit", icon: Crop, pro: false, isNew: true, hero: false },
  { href: "/app/quick-export", label: "Quick Export", icon: Zap, pro: false, isNew: false, hero: false },
  // Freemium: free gets 1 saved pack, Pro unlocks unlimited — no "Pro" badge
  // so free users discover and try it (conversion funnel).
  { href: "/app/my-packs", label: "My Packs", icon: FolderHeart, pro: false, isNew: false, hero: false },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Mode navigation */}
      <div className="border-b border-border bg-surface/40">
        <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MODES.map(({ href, label, icon: Icon, pro, isNew, hero }) => {
            const active = pathname.startsWith(href);
            // Hero (Size Packs) gets a touch more presence when idle — subtle, not a CTA.
            const idleText = hero
              ? "text-foreground/75 hover:bg-surface/70 hover:text-foreground"
              : "text-foreground/50 hover:bg-surface/70 hover:text-foreground/80";
            const idleIcon = hero
              ? "text-foreground/60 group-hover:text-foreground/80"
              : "text-foreground/45 group-hover:text-foreground/70";
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  active
                    ? "bg-accent/10 text-foreground ring-1 ring-inset ring-accent/20"
                    : idleText
                }`}
              >
                <Icon
                  size={14}
                  className={active ? "text-accent-light" : idleIcon}
                />
                {label}
                {pro && (
                  <span className="ml-0.5 rounded-sm bg-accent/20 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider text-accent-light">
                    Pro
                  </span>
                )}
                {isNew && (
                  <span className="ml-0.5 rounded-sm bg-accent/20 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider text-accent-light">
                    New
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

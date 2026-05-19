"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// FolderHeart kept for upcoming My Packs nav-tab re-enable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Layers, Zap, FolderHeart } from "lucide-react";

const MODES = [
  { href: "/app/packs", label: "Packs", icon: Layers, pro: false },
  { href: "/app/quick-export", label: "Quick Export", icon: Zap, pro: false },
  // Hidden during rollout testing — re-enable after Pro-account validation on app.snaptosize.com/app/my-packs
  // { href: "/app/my-packs", label: "My Packs", icon: FolderHeart, pro: true },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Mode navigation */}
      <div className="border-b border-border bg-surface/40">
        <div className="mx-auto flex max-w-[1200px] gap-1 px-4 py-2">
          {MODES.map(({ href, label, icon: Icon, pro }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  active
                    ? "bg-accent/10 text-foreground ring-1 ring-inset ring-accent/20"
                    : "text-foreground/50 hover:bg-surface/70 hover:text-foreground/80"
                }`}
              >
                <Icon
                  size={14}
                  className={active ? "text-accent-light" : "text-foreground/45 group-hover:text-foreground/70"}
                />
                {label}
                {pro && (
                  <span className="ml-0.5 rounded-sm bg-accent/20 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider text-accent-light">
                    Pro
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

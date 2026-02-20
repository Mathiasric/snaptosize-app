"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Zap } from "lucide-react";

const MODES = [
  { href: "/app/packs", label: "Packs", icon: Layers },
  { href: "/app/quick-export", label: "Quick Export", icon: Zap },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Mode navigation */}
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto flex max-w-[1200px] gap-1 px-4 pt-2">
          {MODES.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-accent bg-surface text-foreground"
                    : "text-foreground/40 hover:bg-surface/80 hover:text-foreground/60"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

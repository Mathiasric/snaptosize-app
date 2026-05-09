"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Zap } from "lucide-react";

const MODES = [
  { href: "/app/packs", label: "Packs", icon: Layers, pro: false },
  { href: "/app/quick-export", label: "Quick Export", icon: Zap, pro: false },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Mode navigation */}
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto flex max-w-[1200px] gap-1 px-4 pt-2">
          {MODES.map(({ href, label, icon: Icon, pro }) => {
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
                {pro && (
                  <span className="ml-0.5 rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-accent/20 text-accent">
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

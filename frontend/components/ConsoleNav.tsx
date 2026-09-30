"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/landing/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/localize", label: "Localize" },
  { href: "/visualize", label: "Visualize" },
  { href: "/jobs", label: "Jobs" },
  { href: "/compare", label: "Compare" },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-signal/15 ring-1 ring-signal/30">
            <span className="reticle size-2 rounded-full bg-signal" />
          </span>
          <span className="leading-none">
            <span className="block text-sm font-semibold tracking-tight">LunarSync</span>
            <span className="block font-mono text-[10px] tracking-[0.2em] text-ash">CONSOLE</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 font-mono text-xs">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-2 transition-colors hover:text-bone",
                  active ? "bg-signal/10 text-signal" : "text-mist",
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <span className="ml-2"><ThemeToggle /></span>
        </nav>
      </div>
    </header>
  );
}

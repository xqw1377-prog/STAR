"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ZH } from "@/lib/ui/zh";
import { cn } from "@/lib/utils";

export function SiteNavigation() {
  const pathname = usePathname();
  const primary = NAV_ZH[0];

  return (
    <nav
      aria-label="站点导航"
      className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-3 text-sm sm:basis-auto"
    >
      <Link
        href={primary.href}
        aria-current={pathname === primary.href ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-sm border px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85ded0]",
          pathname === primary.href
            ? "border-[#85ded0] bg-[#85ded0]/10 text-[#85ded0]"
            : "border-[#2c3946] text-[#e5edf4] hover:border-[#85ded0] hover:text-[#85ded0]",
        )}
      >
        <span
          aria-hidden="true"
          className="font-mono text-[10px] font-normal tracking-wider text-[#a9b8c5]"
        >
          主入口
        </span>
        {primary.label}
      </Link>
      <div
        role="group"
        aria-labelledby="fixture-navigation-label"
        className="min-w-0 border-l border-[#2c3946] pl-3"
      >
        <span
          id="fixture-navigation-label"
          className="block text-[11px] font-medium tracking-wide text-[#a9b8c5]"
        >
          证据与观察 · 本地夹具
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {NAV_ZH.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center rounded-sm border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85ded0]",
                pathname === item.href
                  ? "border-[#85ded0] bg-[#85ded0]/10 font-medium text-[#85ded0]"
                  : "border-transparent text-[#a9b8c5] hover:border-[#2c3946] hover:bg-[#2c3946]/40 hover:text-[#e5edf4]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

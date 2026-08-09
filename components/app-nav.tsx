"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppNavLink = {
  href: string;
  label: string;
  shortLabel: string;
};

export function AppNav({ links }: { links: AppNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="bike-app-nav" aria-label="Bike Me">
      {links.map((link) => {
        const active = pathname === link.href || (link.href.split("/").length >= 4 && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className="bike-app-nav-link"
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            <span className="bike-app-nav-marker" aria-hidden="true" />
            <span className="bike-app-nav-label">{link.label}</span>
            <span className="bike-app-nav-short">{link.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}

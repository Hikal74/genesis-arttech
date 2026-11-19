"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./SiteHeader.module.css";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
];

export function SiteHeader() {
  const path = usePathname();
  const onMemory = path.startsWith("/m/") && !path.endsWith("/edit");
  return (
    <header className={`${s.header} ${onMemory ? s.overlay : ""}`}>
      <nav className={s.pill} aria-label="Main">
        <Link href="/" className={s.brand} aria-label="Felt — home">
          <span className={s.mark} aria-hidden><i /></span>
          <b>Felt</b>
        </Link>
        <div className={s.links}>
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={s.link} aria-current={active ? "page" : undefined}>
                {active && <motion.span layoutId="nav-active" className={s.active} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
        <Link href="/new" className={`btn btn-primary btn-small ${s.cta}`}>
          <span className={s.plus} aria-hidden>+</span> New day
        </Link>
      </nav>
    </header>
  );
}

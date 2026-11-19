"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const path = usePathname();
  if (path.startsWith("/m/") && !path.endsWith("/edit")) return <MemoryHeader />;
  return (
    <header className="site-header">
      <div className="wrap">
        <Wordmark />
        <nav className="site-nav" aria-label="Main">
          <Link href="/archive" aria-current={path === "/archive" ? "page" : undefined}>Archive</Link>
          <Link href="/new" className="btn btn-small btn-primary" aria-current={path === "/new" ? "page" : undefined} style={{ color: "var(--ink-0)" }}>
            New day
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Felt — home">
      <span className="dot" aria-hidden />
      <b>Felt</b>
    </Link>
  );
}

function MemoryHeader() {
  return (
    <header className="site-header" style={{ position: "absolute", width: "100%", background: "none", mixBlendMode: "difference" }}>
      <div className="wrap">
        <Wordmark />
        <nav className="site-nav" aria-label="Main">
          <Link href="/archive">Archive</Link>
          <Link href="/new">New day</Link>
        </nav>
      </div>
    </header>
  );
}

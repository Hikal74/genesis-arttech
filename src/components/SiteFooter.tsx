import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>
          <strong style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.3rem", fontWeight: 400 }}>Felt</strong> — a diary for how the day felt. Built for Genesis Hackathon 2026 · ArtTech.
        </p>
        <p>
          Demonstration days are fictional. Their photographs are CC0 (Unsplash, via Wikimedia Commons) and their music was composed for this project. Mood readings are aesthetic, not psychological.
        </p>
        <nav style={{ display: "flex", gap: 20 }} className="meta">
          <Link href="/new">New day</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </div>
    </footer>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { sfx } from "@/lib/client/sound";

const depth = (p: string) => (p === "/" ? 0 : p.startsWith("/archive") ? 1 : p.startsWith("/new") ? 1 : p.startsWith("/year") || p.startsWith("/recap") ? 2 : p.startsWith("/m/") ? 3 : 1);

export function PageTurn() {
  const router = useRouter();
  const path = usePathname();
  const done = useRef<(() => void) | null>(null);

  useEffect(() => {
    const finish = done.current;
    done.current = null;
    if (finish) requestAnimationFrame(() => finish());
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || url.pathname.startsWith("/api")) return;
      const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };
      if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      e.preventDefault();
      const root = document.documentElement;
      root.dataset.turn = depth(url.pathname) < depth(location.pathname) ? "back" : "forward";
      sfx.rustle();
      const turn = doc.startViewTransition(() => new Promise<void>((resolve) => {
        done.current = resolve;
        router.push(url.pathname + url.search + url.hash);
        setTimeout(resolve, 2500);
      }));
      turn.finished.finally(() => { delete root.dataset.turn; });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}

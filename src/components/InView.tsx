"use client";

import { useEffect, useRef } from "react";

export function InView({ children, className, amount = 0.25, as: Tag = "div" }: { children: React.ReactNode; className?: string; amount?: number; as?: "div" | "ul" | "section" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.armed = "";
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.dataset.in = ""; io.disconnect(); }
    }, { threshold: amount });
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);
  return <Tag ref={ref as never} className={className}>{children}</Tag>;
}

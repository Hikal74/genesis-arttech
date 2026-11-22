"use client";

import dynamic from "next/dynamic";

export const LazyChat = dynamic(() => import("./FeltChat").then((m) => m.FeltChat), { ssr: false });

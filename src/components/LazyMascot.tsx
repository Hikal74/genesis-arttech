"use client";

import dynamic from "next/dynamic";

// Nimbus is not needed for the first paint — load it after the page is interactive.
export const LazyMascot = dynamic(() => import("./CloudMascot").then((m) => m.CloudMascot), { ssr: false });

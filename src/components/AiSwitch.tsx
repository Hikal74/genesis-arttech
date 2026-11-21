"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAiStatus, MODELS, resumeAi, startAi, stopAi, subscribeAi, type AiStatus, type ModelChoice } from "@/lib/ai/engine";
import s from "./AiSwitch.module.css";

const OFF: AiStatus = { state: "off" };
const noop = () => () => {};

export function useAiStatus(): AiStatus {
  const status = useSyncExternalStore(subscribeAi, getAiStatus, () => OFF);
  useEffect(resumeAi, []);
  return status;
}

/** Turns the on-device model on/off and shows download progress. */
export function AiSwitch({ compact = false }: { compact?: boolean }) {
  const status = useAiStatus();
  const pick = (m: ModelChoice) => void startAi(m);
  const desktop = useSyncExternalStore(noop, () => !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent), () => true);

  if (status.state === "ready") {
    return (
      <div className={s.row} data-compact={compact || undefined}>
        <span className={s.dot} data-on />
        <span className={s.text}>on-device AI · {MODELS[status.model].label.toLowerCase()} model</span>
        <button type="button" className={s.link} onClick={stopAi}>turn off</button>
      </div>
    );
  }
  if (status.state === "loading") {
    const pct = Math.round(status.progress * 100);
    const eta = status.etaS == null ? "" : status.etaS < 60 ? ` · about ${Math.max(5, Math.round(status.etaS / 5) * 5)} s left` : ` · about ${Math.round(status.etaS / 60)} min left`;
    return (
      <div className={s.box} data-compact={compact || undefined}>
        <div className={s.bar}><i style={{ width: `${pct}%` }} /></div>
        <span className={s.text}>
          {status.cached
            ? `Starting the AI from this device · ${pct}%`
            : status.mb != null && status.totalMb
              ? `Downloading the AI · ${status.mb} of ${status.totalMb} MB${eta} · only once`
              : `Preparing the AI · ${pct}%`}
        </span>
      </div>
    );
  }
  const main: ModelChoice = desktop ? "better" : "light";
  const other: ModelChoice = main === "better" ? "light" : "better";
  return (
    <div className={s.box} data-compact={compact || undefined}>
      <span className={s.text}>
        {status.state === "unsupported" ? status.reason
          : status.state === "error" ? `AI could not start: ${status.message}`
          : "AI that runs on your own device — one download, then it works instantly, even offline. Nothing you write leaves the browser."}
      </span>
      {status.state !== "unsupported" && (
        <div className={s.choices}>
          <button type="button" className="btn btn-small btn-primary" onClick={() => pick(main)}>
            Turn on AI <em className={s.size}>{MODELS[main].size}</em>
          </button>
          <button type="button" className={s.link} onClick={() => pick(other)}>
            or the {MODELS[other].label.toLowerCase()} version ({MODELS[other].size})
          </button>
        </div>
      )}
    </div>
  );
}

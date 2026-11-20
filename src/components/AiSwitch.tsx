"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAiStatus, MODELS, resumeAi, startAi, stopAi, subscribeAi, type AiStatus, type ModelChoice } from "@/lib/ai/engine";
import s from "./AiSwitch.module.css";

const OFF: AiStatus = { state: "off" };

export function useAiStatus(): AiStatus {
  const status = useSyncExternalStore(subscribeAi, getAiStatus, () => OFF);
  useEffect(resumeAi, []);
  return status;
}

/** Turns the on-device model on/off and shows download progress. */
export function AiSwitch({ compact = false }: { compact?: boolean }) {
  const status = useAiStatus();
  const pick = (m: ModelChoice) => void startAi(m);

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
    return (
      <div className={s.box} data-compact={compact || undefined}>
        <div className={s.bar}><i style={{ width: `${Math.round(status.progress * 100)}%` }} /></div>
        <span className={s.text}>{Math.round(status.progress * 100)}% · {status.text || "downloading the model to this device…"}</span>
      </div>
    );
  }
  return (
    <div className={s.box} data-compact={compact || undefined}>
      <span className={s.text}>
        {status.state === "unsupported" ? status.reason
          : status.state === "error" ? `AI could not start: ${status.message}`
          : "Smart AI runs on your own device — downloaded once, nothing you write leaves the browser."}
      </span>
      {status.state !== "unsupported" && (
        <div className={s.choices}>
          {(Object.keys(MODELS) as ModelChoice[]).map((m) => (
            <button key={m} type="button" className="btn btn-small" onClick={() => pick(m)}>
              ✦ {MODELS[m].label} <em className={s.size}>{MODELS[m].size}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

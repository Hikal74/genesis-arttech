"use client";

import { useEffect, useRef, useState } from "react";
import { autoStartAi, getAiStatus, startAi } from "@/lib/ai/engine";
import { getMascotContext } from "@/lib/client/mascot-context";
import { AiSwitch, useAiStatus } from "./AiSwitch";
import s from "./FeltChat.module.css";

type Msg = { role: "user" | "assistant"; content: string };

/** Felt AI: a chat that runs entirely on the visitor's device through WebLLM. */
export function FeltChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const status = useAiStatus();
  const list = useRef<HTMLDivElement>(null);
  const ready = status.state === "ready";

  useEffect(() => { if (open) autoStartAi(); }, [open]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const unsupported = status.state === "unsupported";
    if (unsupported) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    try {
      // Typed before the model finished loading: wait for it, then answer this exact message.
      if (getAiStatus().state !== "ready") {
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "Loading the AI on your device… I’ll answer as soon as it’s ready." }]);
        const engine = await startAi();
        if (!engine) {
          setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "The AI could not start in this browser, so I can’t answer yet." }]);
          return;
        }
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "" }]);
      }
      const { aiChat } = await import("@/lib/ai");
      const reply = await aiChat(next, getMascotContext()?.slice(0, 3000) || undefined, (soFar) =>
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: soFar }]),
      );
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: reply ?? "Sorry — the model stopped. Try again?" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={s.launcher} onPointerEnter={autoStartAi} onFocus={autoStartAi} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="felt-chat">
        <span className={s.dot} data-on={ready || undefined} aria-hidden />
        {open ? "Close" : "Ask Felt AI"}
      </button>

      {open && (
        <section id="felt-chat" className={s.panel} role="dialog" aria-label="Felt AI chat">
          <header className={s.head}>
            <div>
              <h2 className={s.title}>Felt AI</h2>
              <p className={s.sub}>An open model running in your browser. Nothing you type leaves this device.</p>
            </div>
            <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>

          {(!ready || (status.state === "ready" && status.upgrading != null && status.upgrading < 100)) && <div className={s.status}><AiSwitch compact /></div>}

          <div className={s.list} ref={list}>
            {msgs.length === 0 && (
              <div className={s.empty}>
                <p>Ask anything: help describing your day, a title, a song idea, or a question of your own.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={s.msg} data-role={m.role}>
                {m.content || <span className={s.typing} aria-label="Thinking"><i /><i /><i /></span>}
              </div>
            ))}
          </div>

          <form className={s.form} onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ready ? "Write a message…" : status.state === "unsupported" ? "AI isn’t available in this browser" : "Write a message (answered once the AI loads)…"}
              maxLength={1500}
              disabled={status.state === "unsupported"}
              aria-label="Message"
              autoFocus
            />
            <button type="submit" className={s.send} disabled={status.state === "unsupported" || busy || !draft.trim()}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}

"use client";

import type { ChatCompletionMessageParam, MLCEngineInterface } from "@mlc-ai/web-llm";

// On-device AI: an open model (WebLLM / MLC) downloaded once into the browser cache
// and run on the visitor's GPU through WebGPU. Nothing is sent to an AI server.

export const MODELS = {
  light: { id: "Qwen2.5-0.5B-Instruct", label: "Light", size: "280 MB", mb: 280 },
  better: { id: "Qwen2.5-1.5B-Instruct", label: "Better", size: "870 MB", mb: 870 },
} as const;
export type ModelChoice = keyof typeof MODELS;

export type AiStatus =
  | { state: "off" }
  | { state: "unsupported"; reason: string }
  | { state: "loading"; progress: number; text: string; cached?: boolean; mb?: number; totalMb?: number; etaS?: number | null }
  | { state: "ready"; model: ModelChoice; upgrading?: number | null }
  | { state: "error"; message: string };

const PREF_KEY = "felt:ai-model";
const DECLINED_KEY = "felt:ai-declined";

let status: AiStatus = { state: "off" };
let engine: MLCEngineInterface | null = null;
export let engineRuntime: "worker" | "main" | null = null;
let loading: Promise<MLCEngineInterface | null> | null = null;
const listeners = new Set<(s: AiStatus) => void>();

function set(next: AiStatus) {
  status = next;
  listeners.forEach((l) => l(next));
}

export const getAiStatus = () => status;
export function subscribeAi(fn: (s: AiStatus) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

const isDesktop = () => typeof navigator !== "undefined" && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export function savedModel(): ModelChoice | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    // The light model often ignores questions; computers always get the stronger one.
    if (v === "light" && isDesktop()) return "better";
    return v === "light" || v === "better" ? v : null;
  } catch {
    return null;
  }
}

async function gpuSupport(): Promise<{ ok: boolean; f16: boolean; reason?: string }> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu) return { ok: false, f16: false, reason: "This browser has no WebGPU. Try Chrome or Edge on a laptop or desktop." };
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter) return { ok: false, f16: false, reason: "No compatible graphics adapter was found for on-device AI." };
  return { ok: true, f16: adapter.features.has("shader-f16") };
}

/** Run the model in a Web Worker (keeps scrolling and montages smooth); null if workers are unavailable. */
async function createInWorker(
  webllm: typeof import("@mlc-ai/web-llm"),
  modelId: string,
  initProgressCallback: (r: { progress: number; text: string }) => void,
  chatOpts: { context_window_size: number },
): Promise<MLCEngineInterface | null> {
  if (typeof Worker === "undefined") return null;
  let worker: Worker | null = null;
  try {
    worker = new Worker("/webllm-worker.js", { type: "module" });
    const failed = new Promise<null>((resolve) => { worker!.onerror = () => resolve(null); });
    const created = webllm.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback }, chatOpts);
    const result = await Promise.race([created, failed]);
    if (!result) worker.terminate();
    else activeWorker = worker;
    return result;
  } catch {
    worker?.terminate();
    return null;
  }
}

const PARALLEL_DOWNLOADS = 8;

/**
 * Faster first download: fetch the model's weight files with more parallel connections than WebLLM's
 * built-in 4, straight into the cache WebLLM reads from ("webllm/model", keyed by URL). WebLLM then
 * finds every file already cached and goes straight to loading. Any failure just falls back to WebLLM.
 */
async function fastDownload(
  webllm: typeof import("@mlc-ai/web-llm"),
  modelId: string,
  onProgress: (doneBytes: number, totalBytes: number) => void,
): Promise<void> {
  if (typeof caches === "undefined") return;
  const record = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === modelId);
  if (!record) return;
  let base = record.model.endsWith("/") ? record.model : `${record.model}/`;
  if (!/\/resolve\/.+\//.test(base)) base += "resolve/main/";
  base = new URL(base).href;

  const cache = await caches.open("webllm/model");
  const manifestUrl = new URL("tensor-cache.json", base).href;
  let manifest = await cache.match(manifestUrl);
  if (!manifest) {
    const res = await fetch(manifestUrl);
    if (!res.ok) return;
    await cache.put(manifestUrl, res.clone());
    manifest = res;
  }
  const records = ((await manifest.json()) as { records: { dataPath: string; nbytes: number }[] }).records;
  const urlOf = (r: { dataPath: string }) => new URL(r.dataPath, base).href;
  const cachedUrls = new Set((await cache.keys()).map((r) => r.url));
  const total = records.reduce((n, r) => n + r.nbytes, 0);
  let done = records.filter((r) => cachedUrls.has(urlOf(r))).reduce((n, r) => n + r.nbytes, 0);
  const todo = records.filter((r) => !cachedUrls.has(urlOf(r)));
  onProgress(done, total);
  // Report at most 4 times a second: per-chunk updates from 8 streams would flood React and freeze the page.
  let lastReport = 0;
  const report = () => {
    const now = performance.now();
    if (now - lastReport < 250) return;
    lastReport = now;
    onProgress(done, total);
  };

  const fetchOne = async (r: { dataPath: string; nbytes: number }) => {
    const url = urlOf(r);
    for (let attempt = 0; ; attempt++) {
      let got = 0;
      try {
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const parts: Uint8Array[] = [];
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          parts.push(value);
          got += value.length;
          done += value.length;
          report();
        }
        await cache.put(url, new Response(new Blob(parts as BlobPart[]), { headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" } }));
        return;
      } catch (err) {
        done -= got;
        if (attempt >= 2) throw err;
      }
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < todo.length) await fetchOne(todo[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, todo.length) }, worker));
  onProgress(done, total);
}

type WebLLM = typeof import("@mlc-ai/web-llm");
const modelIdFor = (choice: ModelChoice, f16: boolean) => `${MODELS[choice].id}-${f16 ? "q4f16_1" : "q4f32_1"}-MLC`;
let activeWorker: Worker | null = null;
let upgradeStarted = false;

/** Download (first time) and start one model. Callers hold the `loading` lock. */
async function loadModel(choice: ModelChoice): Promise<MLCEngineInterface | null> {
    const gpu = await gpuSupport();
    if (!gpu.ok) {
      set({ state: "unsupported", reason: gpu.reason! });
      return null;
    }
    set({ state: "loading", progress: 0, text: "Preparing on-device AI…" });
    try {
      const webllm = await import("@mlc-ai/web-llm");
      const modelId = modelIdFor(choice, gpu.f16);
      const cached = await webllm.hasModelInCache(modelId).catch(() => false);
      const totalMb = MODELS[choice].mb;
      const started = performance.now();
      const initProgressCallback = (r: { progress: number; text: string }) => {
        const mb = Number(r.text.match(/(\d+)MB (?:fetched|loaded)/)?.[1] ?? Math.round(r.progress * totalMb));
        const secs = (performance.now() - started) / 1000;
        const etaS = !cached && mb > 20 && secs > 2 ? Math.max(0, Math.round(((totalMb - mb) / mb) * secs)) : null;
        set({ state: "loading", progress: r.progress, text: r.text.replace(/\[.*?\]\s*/g, "").slice(0, 140), cached, mb: Math.min(mb, totalMb), totalMb, etaS });
      };
      if (engine) await engine.unload().catch(() => {});
      activeWorker?.terminate();
      activeWorker = null;
      if (!cached) {
        // Phase 1: our parallel download into WebLLM's cache (falls back to WebLLM's own download on failure).
        await fastDownload(webllm, modelId, (doneBytes, totalBytes) => {
          const mb = Math.round(doneBytes / 1e6);
          const secs = (performance.now() - started) / 1000;
          const etaS = mb > 20 && secs > 2 ? Math.max(0, Math.round(((totalBytes - doneBytes) / doneBytes) * secs)) : null;
          set({ state: "loading", progress: doneBytes / totalBytes, text: "Downloading", cached: false, mb, totalMb: Math.round(totalBytes / 1e6), etaS });
        }).catch((err) => console.warn("[ai] fast download fell back to WebLLM:", err));
      }
      // Phase 2: WebLLM finds the files in its cache and loads them onto the GPU.
      const loadProgress = (r: { progress: number; text: string }) =>
        /loading model from cache|finish loading/i.test(r.text) || cachedNow
          ? set({ state: "loading", progress: r.progress, text: "Starting", cached: true, totalMb })
          : initProgressCallback(r);
      const cachedNow = cached || (await webllm.hasModelInCache(modelId).catch(() => false));
      // Smaller context window: less GPU memory, faster start and faster first token.
      const chatOpts = { context_window_size: 2048 };
      const inWorker = await createInWorker(webllm, modelId, loadProgress, chatOpts);
      engine = inWorker ?? await webllm.CreateMLCEngine(modelId, { initProgressCallback: loadProgress }, chatOpts);
      engineRuntime = inWorker ? "worker" : "main";
      // Ask the browser to keep the downloaded model, so it is never fetched twice.
      void navigator.storage?.persist?.().catch(() => false);
      try { localStorage.setItem(PREF_KEY, choice); localStorage.removeItem(DECLINED_KEY); } catch {}
      set({ state: "ready", model: choice });
      return engine;
    } catch (err) {
      engine = null;
      set({ state: "error", message: err instanceof Error ? err.message.slice(0, 200) : "The model could not start." });
      return null;
    }
}

/**
 * Download (first time) and start the on-device model. Safe to call many times.
 * On a first visit to a computer, the small model (280 MB) starts first so the chat works within a couple
 * of minutes; the better model downloads in the background and replaces it automatically when ready.
 */
export function startAi(choice: ModelChoice = savedModel() ?? (isDesktop() ? "better" : "light")): Promise<MLCEngineInterface | null> {
  if (engine && status.state === "ready" && status.model === choice) return Promise.resolve(engine);
  if (engine && status.state === "ready" && status.model === "light" && choice === "better" && upgradeStarted) return Promise.resolve(engine);
  if (loading) return loading;
  loading = (async () => {
    if (choice === "better" && isDesktop()) {
      const gpu = await gpuSupport();
      if (gpu.ok) {
        const webllm = await import("@mlc-ai/web-llm");
        const betterCached = await webllm.hasModelInCache(modelIdFor("better", gpu.f16)).catch(() => false);
        if (!betterCached) {
          const first = await loadModel("light");
          if (first) void upgradeInBackground(webllm, gpu.f16);
          return first;
        }
      }
    }
    return loadModel(choice);
  })().finally(() => { loading = null; });
  return loading;
}

/** Fetch the better model into the cache while the light one is answering, then swap to it. */
async function upgradeInBackground(webllm: WebLLM, f16: boolean) {
  if (upgradeStarted) return;
  upgradeStarted = true;
  try {
    await fastDownload(webllm, modelIdFor("better", f16), (doneBytes, totalBytes) => {
      if (status.state === "ready") set({ ...status, upgrading: Math.round((doneBytes / totalBytes) * 100) });
    });
    if (!(await webllm.hasModelInCache(modelIdFor("better", f16)).catch(() => false))) return;
    await queue; // let any reply in progress finish first
    if (loading) await loading;
    loading = loadModel("better").finally(() => { loading = null; });
    await loading;
  } catch (err) {
    console.warn("[ai] background upgrade stopped:", err);
    if (status.state === "ready") set({ ...status, upgrading: null });
  }
}

/** Re-open the model on later visits if the visitor already turned it on (it loads from cache). */
export function resumeAi() {
  if (typeof window === "undefined" || status.state !== "off") return;
  const choice = savedModel();
  if (choice) void startAi(choice);
}

/**
 * Start WebLLM without a click (when the chat opens): light model, only on devices with WebGPU,
 * not on mobile data / data saver, and never again after the visitor turned AI off.
 */
export function autoStartAi() {
  if (typeof window === "undefined" || status.state !== "off") return;
  try { if (localStorage.getItem(DECLINED_KEY) === "1") return; } catch {}
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string; effectiveType?: string } }).connection;
  if (c?.saveData || c?.type === "cellular" || /(^|-)2g|3g/.test(c?.effectiveType ?? "")) return;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const desktop = !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  // The 1.5B model talks far better; use it where it fits comfortably.
  void startAi(savedModel() ?? (desktop || mem >= 6 ? "better" : "light"));
}

export function stopAi() {
  try { localStorage.removeItem(PREF_KEY); localStorage.setItem(DECLINED_KEY, "1"); } catch {}
  void engine?.unload().catch(() => {});
  engine = null;
  set({ state: "off" });
}

let queue: Promise<unknown> = Promise.resolve();

/** One completion at a time; returns null when the model is not running. */
export function complete(messages: ChatCompletionMessageParam[], opts: { maxTokens: number; temperature?: number; json?: boolean }): Promise<string | null> {
  const run = async () => {
    if (!engine || status.state !== "ready") return null;
    try {
      const res = await engine.chat.completions.create({
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
      });
      return res.choices[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error("[ai]", err instanceof Error ? err.message : String(err));
      return null;
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

/** Streams a completion token by token; resolves to the full text (null when the model is not running). */
export function completeStream(messages: ChatCompletionMessageParam[], onText: (soFar: string) => void, opts: { maxTokens: number; temperature?: number }): Promise<string | null> {
  const run = async () => {
    if (!engine || status.state !== "ready") return null;
    try {
      const chunks = await engine.chat.completions.create({ messages, max_tokens: opts.maxTokens, temperature: opts.temperature ?? 0.7, stream: true });
      let text = "";
      for await (const c of chunks) {
        text += c.choices[0]?.delta?.content ?? "";
        onText(text);
      }
      return text.trim() || null;
    } catch (err) {
      console.error("[ai]", err instanceof Error ? err.message : String(err));
      return null;
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

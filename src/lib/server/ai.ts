import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM, MUSIC_SYSTEM, TITLE_SYSTEM } from "../ai/prompts";
import { cleanInput, fence, scrubReply } from "../ai/guard";

/*
 * Felt's AI backend: Claude through the official Anthropic SDK.
 * Credentials come only from the environment (ANTHROPIC_API_KEY), never from code or the browser.
 * Model and effort are configurable, so the model can change without touching the frontend.
 */

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export const AI_MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-opus-5-5";
const envEffort = process.env.CLAUDE_EFFORT?.trim() as Effort | undefined;
export const AI_EFFORT: Effort = envEffort && EFFORTS.includes(envEffort) ? envEffort : "low";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

// Server-side refusal fallback (re-runs a declined request on another model inside the same call).
// Only these models accept it; for anything else the parameter is left out.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-fable-5-2"]);

let client: Anthropic | null = null;
export const claude = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 }));

/** Named presets: the browser picks one by name; the system prompt and limits stay here. */
export const PRESETS = {
  "felt-chat": { system: process.env.FELT_CHAT_SYSTEM_PROMPT?.trim() || CHAT_SYSTEM, maxTokens: 4000, contextAllowed: true },
  "felt-title": { system: TITLE_SYSTEM, maxTokens: 1500, contextAllowed: false },
  "felt-music": { system: MUSIC_SYSTEM, maxTokens: 3000, contextAllowed: false },
} as const;
export type PresetName = keyof typeof PRESETS;

/** Structured output for song suggestions: the API guarantees JSON matching this schema. */
export const MUSIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["songs"],
  properties: {
    songs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "artist", "bpm", "energy", "mode", "reason"],
        properties: {
          title: { type: "string" },
          artist: { type: "string" },
          bpm: { type: "number" },
          energy: { type: "number" },
          mode: { type: "string", enum: ["major", "minor"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

/** Builds the request body shared by streaming and non-streaming calls. */
export function buildRequest(preset: PresetName, messages: Anthropic.Beta.BetaMessageParam[], context: string | null, maxTokens?: number) {
  const p = PRESETS[preset];
  const system = context && p.contextAllowed ? `${p.system}\n\nToday's diary text so far (context only):\n${fence("diary_text", cleanInput(context, 3000))}` : p.system;
  const fallback = FALLBACK_MODELS.has(AI_MODEL);
  return {
    model: AI_MODEL,
    max_tokens: Math.min(maxTokens ?? p.maxTokens, p.maxTokens),
    system,
    messages,
    output_config: {
      effort: AI_EFFORT,
      ...(preset === "felt-music" ? { format: { type: "json_schema" as const, schema: MUSIC_SCHEMA } } : {}),
    },
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  } satisfies Anthropic.Beta.MessageCreateParamsNonStreaming;
}

/** Plain text of a finished reply, scrubbed; null when Claude declined. */
export function replyText(message: Anthropic.Beta.BetaMessage): string | null {
  if (message.stop_reason === "refusal") return null;
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text ? scrubReply(text, 4000) : null;
}

/** One JSON line per call in the server logs: what it cost, without any diary text. */
export function logUsage(preset: string, message: Pick<Anthropic.Beta.BetaMessage, "model" | "usage" | "stop_reason">, startedAt: number) {
  const u = message.usage;
  console.info(JSON.stringify({
    event: "ai_usage",
    preset,
    model: message.model,
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    stop_reason: message.stop_reason,
    ms: Date.now() - startedAt,
  }));
}

/** Server-side title for a new memory. Returns null on any failure so the local title is used. */
export async function claudeTitle(text: string): Promise<string | null> {
  if (!aiEnabled()) return null;
  const started = Date.now();
  try {
    const message = await claude().beta.messages.create(
      buildRequest("felt-title", [{ role: "user", content: fence("diary_text", cleanInput(text, 4000)) }], null),
      { timeout: 15_000, maxRetries: 1 },
    );
    logUsage("felt-title", message, started);
    const line = replyText(message)?.split("\n").find((l) => l.trim()) ?? "";
    const words = line.replace(/["'«»“”*#]/g, "").replace(/[.!,;:]+$/, "").trim().split(/\s+/).filter(Boolean);
    return words.length >= 3 && words.length <= 8 ? words.slice(0, 7).join(" ") : null;
  } catch (err) {
    console.error("[ai] title failed:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return null;
  }
}

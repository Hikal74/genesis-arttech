import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { looksLikeExtraction } from "@/lib/ai/guard";
import { REFUSAL_SECRET } from "@/lib/ai/prompts";
import { aiEnabled, buildRequest, claude, logUsage, PRESETS, replyText, type PresetName } from "@/lib/server/ai";
import { rateLimited } from "@/lib/server/ratelimit";

/*
 * POST /api/ai/chat/completions — OpenAI-compatible request and response shapes, backed by Claude.
 *
 *   { "model": "felt-chat" | "felt-title" | "felt-music", "messages": [...], "stream": true }
 *
 * `model` names a server-side preset (its system prompt and limits live on the server), so the
 * browser never chooses the real model or sees the prompt. A `system` message from the browser is
 * treated as diary context for felt-chat only. Streaming uses OpenAI-style SSE chunks + `[DONE]`.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Message = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
});
const Body = z.object({
  model: z.enum(Object.keys(PRESETS) as [PresetName, ...PresetName[]]).default("felt-chat"),
  messages: z.array(Message).min(1).max(40),
  stream: z.boolean().default(false),
  max_tokens: z.number().int().min(16).max(4000).optional(),
});

const LIMITS: Record<PresetName, number> = { "felt-chat": 40, "felt-title": 30, "felt-music": 30 };

function apiError(status: number, message: string, type: string) {
  return Response.json({ error: { message, type } }, { status, headers: { "cache-control": "no-store" } });
}

const completion = (id: string, model: string, content: string, finish: string, usage?: { prompt_tokens: number; completion_tokens: number }) => ({
  id,
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finish }],
  ...(usage ? { usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens } } : {}),
});

const finishReason = (stop: string | null) => (stop === "max_tokens" ? "length" : stop === "refusal" ? "content_filter" : "stop");

export async function POST(request: Request) {
  if (!aiEnabled()) return apiError(503, "AI is not configured on this server.", "ai_disabled");

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (err) {
    return apiError(400, err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid request" : "Invalid JSON", "invalid_request_error");
  }
  if (rateLimited(request, `ai:${body.model}`, LIMITS[body.model], 10 * 60 * 1000)) {
    return apiError(429, "Too many requests. Please wait a few minutes.", "rate_limit_error");
  }

  // Diary context arrives as system messages; the conversation itself must end with the user.
  const context = body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") || null;
  const turns = body.messages.filter((m) => m.role !== "system").slice(-24) as Anthropic.Beta.BetaMessageParam[];
  const last = turns.at(-1);
  if (!last || last.role !== "user") return apiError(400, "The last message must come from the user.", "invalid_request_error");
  while (turns[0]?.role === "assistant") turns.shift();

  const id = `chatcmpl-${crypto.randomUUID()}`;
  const preset = body.model;

  // Obvious attempts to extract instructions or keys never reach the model.
  if (typeof last.content === "string" && looksLikeExtraction(last.content)) {
    if (!body.stream) return Response.json(completion(id, preset, REFUSAL_SECRET, "stop"));
    return sse((send) => {
      send({ id, object: "chat.completion.chunk", model: preset, choices: [{ index: 0, delta: { role: "assistant", content: REFUSAL_SECRET }, finish_reason: null }] });
      send({ id, object: "chat.completion.chunk", model: preset, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    });
  }

  const params = buildRequest(preset, turns, context, body.max_tokens);
  const started = Date.now();

  if (!body.stream) {
    try {
      const message = await claude().beta.messages.create(params, { signal: request.signal });
      logUsage(preset, message, started);
      const text = replyText(message) ?? "Sorry, I can't help with that one.";
      return Response.json(completion(id, preset, text, finishReason(message.stop_reason), {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
      }), { headers: { "cache-control": "no-store" } });
    } catch (err) {
      return upstreamError(err);
    }
  }

  return sse(async (send) => {
    const stream = claude().beta.messages.stream(params, { signal: request.signal });
    try {
      let first = true;
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ id, object: "chat.completion.chunk", model: preset, choices: [{ index: 0, delta: first ? { role: "assistant", content: event.delta.text } : { content: event.delta.text }, finish_reason: null }] });
          first = false;
        }
      }
      const message = await stream.finalMessage();
      logUsage(preset, message, started);
      if (message.stop_reason === "refusal" && first) {
        send({ id, object: "chat.completion.chunk", model: preset, choices: [{ index: 0, delta: { role: "assistant", content: "Sorry, I can't help with that one." }, finish_reason: null }] });
      }
      send({
        id, object: "chat.completion.chunk", model: preset,
        choices: [{ index: 0, delta: {}, finish_reason: finishReason(message.stop_reason) }],
        usage: { prompt_tokens: message.usage.input_tokens, completion_tokens: message.usage.output_tokens, total_tokens: message.usage.input_tokens + message.usage.output_tokens },
      });
    } catch (err) {
      if (request.signal.aborted) return;
      console.error("[ai] stream failed:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
      const { message, type } = describe(err);
      send({ error: { message, type } });
    }
  });
}

/** Server-sent events in the OpenAI style: `data: {json}` lines, then `data: [DONE]`. */
function sse(run: (send: (data: unknown) => void) => void | Promise<void>) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        await run(send);
      } finally {
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}

function describe(err: unknown): { status: number; message: string; type: string } {
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "The AI is busy right now. Try again in a moment.", type: "rate_limit_error" };
  if (err instanceof Anthropic.AuthenticationError) return { status: 503, message: "The AI key on the server is not valid.", type: "ai_disabled" };
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: "The AI could not process that request.", type: "invalid_request_error" };
  if (err instanceof Anthropic.APIError) return { status: 502, message: "The AI service had a problem. Please try again.", type: "api_error" };
  return { status: 502, message: "Could not reach the AI service. Please try again.", type: "api_error" };
}

function upstreamError(err: unknown) {
  console.error("[ai] request failed:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
  const { status, message, type } = describe(err);
  return apiError(status, message, type);
}

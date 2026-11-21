// Runs the on-device model off the main thread so pages and montages stay smooth.
// Version is pinned to match the app's @mlc-ai/web-llm package.
import { WebWorkerMLCEngineHandler } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.87/+esm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);

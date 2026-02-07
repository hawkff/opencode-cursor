#!/usr/bin/env bun
/**
 * Standalone server entry point for Docker/direct usage.
 * Starts the cursor-acp HTTP proxy without needing OpenCode.
 * 
 * Supports thinking/reasoning models by parsing stream-json output
 * and including reasoning_content in OpenAI-compatible responses.
 */

import { createServer } from "http";
import { spawn, execSync } from "child_process";
import { createInterface } from "readline";
import { createLogger } from "./utils/logger";
import { parseAgentError, formatErrorForUser, stripAnsi } from "./utils/errors";

const log = createLogger("standalone");

const HOST = process.env.CURSOR_ACP_HOST || "0.0.0.0";
const PORT = parseInt(process.env.CURSOR_ACP_PORT || "32124", 10);
const WORKSPACE = process.env.CURSOR_ACP_WORKSPACE || "/workspace";

interface ChatMessage {
  role: string;
  content: string;
  reasoning_content?: string;
}

function createChatCompletionResponse(model: string, content: string, reasoningContent?: string) {
  const message: ChatMessage = { role: "assistant", content };
  if (reasoningContent) {
    message.reasoning_content = reasoningContent;
  }
  return {
    id: `cursor-acp-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: "stop",
      },
    ],
  };
}

async function handleRequest(req: any, res: any): Promise<void> {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Model discovery
    if (url.pathname === "/v1/models" || url.pathname === "/models") {
      try {
        const output = execSync("cursor-agent models", { encoding: "utf-8", timeout: 30000 });
        const clean = stripAnsi(output);
        const models: Array<{ id: string; object: string; created: number; owned_by: string }> = [];
        for (const line of clean.split("\n")) {
          const match = line.match(/^([a-z0-9.-]+)\s+-\s+(.+?)(?:\s+\((current|default)\))*\s*$/i);
          if (match) {
            models.push({
              id: match[1],
              object: "model",
              created: Math.floor(Date.now() / 1000),
              owned_by: "cursor",
            });
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: models }));
      } catch (err) {
        log.error("Failed to list models", { error: String(err) });
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch models" }));
      }
      return;
    }

    // Chat completions
    if (url.pathname !== "/v1/chat/completions" && url.pathname !== "/chat/completions") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Unsupported path: ${url.pathname}` }));
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    const bodyData: any = JSON.parse(body || "{}");
    const messages: Array<any> = Array.isArray(bodyData?.messages) ? bodyData.messages : [];
    const stream = bodyData?.stream === true;

    // Convert messages to prompt
    const lines: string[] = [];
    for (const message of messages) {
      const role = typeof message.role === "string" ? message.role : "user";
      const content = message.content;

      if (typeof content === "string") {
        lines.push(`${role.toUpperCase()}: ${content}`);
      } else if (Array.isArray(content)) {
        const textParts = content
          .map((part: any) => {
            if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
              return part.text;
            }
            return "";
          })
          .filter(Boolean);
        if (textParts.length) {
          lines.push(`${role.toUpperCase()}: ${textParts.join("\n")}`);
        }
      }
    }
    const prompt = lines.join("\n\n");
    const model = typeof bodyData?.model === "string" ? bodyData.model : "auto";

    // Use stream-json format to capture thinking content
    const cmd = [
      "cursor-agent",
      "--print",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--workspace",
      WORKSPACE,
      "--model",
      model,
    ];

    const child = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "pipe"] });

    // Write prompt to stdin to avoid E2BIG error
    child.stdin.write(prompt);
    child.stdin.end();

    if (!stream) {
      // Non-streaming: collect all output, parse JSON lines, extract thinking + content
      let thinkingContent = "";
      let assistantContent = "";
      let finalResult = "";
      const stderrChunks: Buffer[] = [];

      const rl = createInterface({ input: child.stdout });
      
      rl.on("line", (line) => {
        try {
          const data = JSON.parse(line);
          
          if (data.type === "thinking" && data.subtype === "delta" && data.text) {
            thinkingContent += data.text;
          } else if (data.type === "assistant" && data.message?.content) {
            // Handle incremental content
            const content = data.message.content;
            if (Array.isArray(content)) {
              for (const part of content) {
                if (part.type === "text" && part.text) {
                  // Only add if it's a delta (partial), not final accumulated
                  if (data.timestamp_ms) {
                    assistantContent += part.text;
                  }
                }
              }
            }
          } else if (data.type === "result" && data.result) {
            // Use the final result as the authoritative content
            finalResult = data.result;
          }
        } catch {
          // Ignore non-JSON lines
        }
      });

      child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

      child.on("close", (code) => {
        const stderr = Buffer.concat(stderrChunks).toString().trim();

        if (code !== 0 && stderr.length > 0) {
          const parsed = parseAgentError(stderr);
          const userError = formatErrorForUser(parsed);
          log.error("cursor-agent failed", { type: parsed.type, message: parsed.message });
          const errorResponse = createChatCompletionResponse(model, userError);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(errorResponse));
          return;
        }

        // Use finalResult if available, otherwise use accumulated assistantContent
        const content = finalResult || assistantContent || stderr;
        const response = createChatCompletionResponse(
          model, 
          content, 
          thinkingContent || undefined
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      });
    } else {
      // Streaming mode
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const id = `cursor-acp-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      let sentThinkingStart = false;

      const rl = createInterface({ input: child.stdout });

      rl.on("line", (line) => {
        try {
          const data = JSON.parse(line);

          if (data.type === "thinking" && data.subtype === "delta" && data.text) {
            // Send thinking content with reasoning_content delta
            const chunkData = {
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: sentThinkingStart 
                    ? { reasoning_content: data.text }
                    : { role: "assistant", reasoning_content: data.text },
                  finish_reason: null,
                },
              ],
            };
            sentThinkingStart = true;
            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
          } else if (data.type === "assistant" && data.message?.content && data.timestamp_ms) {
            // Send assistant content deltas (only partials with timestamp_ms)
            const content = data.message.content;
            if (Array.isArray(content)) {
              for (const part of content) {
                if (part.type === "text" && part.text) {
                  const chunkData = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: { content: part.text },
                        finish_reason: null,
                      },
                    ],
                  };
                  res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                }
              }
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      });

      child.on("close", (code) => {
        if (code !== 0) {
          const stderrChunks: Buffer[] = [];
          child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
          child.stderr.on("end", () => {
            const stderr = Buffer.concat(stderrChunks).toString();
            if (stderr) {
              const errChunk = {
                id,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta: { content: `Error: ${stderr}` }, finish_reason: "stop" }],
              };
              res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
            }
          });
        }

        const doneChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        };
        res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Request error", { error: message });
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}

const server = createServer(handleRequest);

server.listen(PORT, HOST, () => {
  log.info(`cursor-acp proxy started`, { host: HOST, port: PORT, workspace: WORKSPACE });
  console.log(`cursor-acp proxy listening on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`Models: http://${HOST}:${PORT}/v1/models`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log.info("Received SIGTERM, shutting down");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  log.info("Received SIGINT, shutting down");
  server.close(() => process.exit(0));
});

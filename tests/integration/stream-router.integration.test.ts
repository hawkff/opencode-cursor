import { describe, it, expect } from "bun:test";
import { ToolRouter } from "../../src/tools/router.js";
import { OpenCodeToolExecutor } from "../../src/tools/executor.js";
import { StreamToSseConverter } from "../../src/streaming/openai-sse.js";
import { parseStreamJsonLine } from "../../src/streaming/parser.js";

// Simulate a cursor-agent stream with a tool_call and ensure router injects a tool_result chunk

describe("Stream + ToolRouter end-to-end", () => {
  it("injects tool_result into SSE stream", async () => {
    const toolsByName = new Map();
    toolsByName.set("oc_brainstorm", { id: "brainstorm", name: "oc_brainstorm", description: "", parameters: {} });

    // Executor echoes args
    const executor = new (class extends OpenCodeToolExecutor {
      constructor() { super({}, { mode: "sdk" }); }
      async execute(toolId: string, args: any) {
        return { status: "success", output: JSON.stringify({ toolId, args }) };
      }
    })();

    const router = new ToolRouter({ executor, toolsByName });
    const converter = new StreamToSseConverter("cursor", { id: "chunk-1", created: 123 });

    const toolCallEvent = {
      type: "tool_call",
      call_id: "call-1",
      name: "oc_brainstorm",
      tool_call: { oc_brainstorm: { args: { topic: "pong" } } },
    };

    const sse = converter.handleEvent(toolCallEvent);

    // Router injects an extra chunk
    const toolResult = await router.handleToolCall(toolCallEvent as any, { id: "chunk-1", created: 123, model: "cursor" });

    expect(toolResult).not.toBeNull();
    expect(toolResult?.choices[0].delta.tool_calls[0].function.name).toBe("oc_brainstorm");
    expect(toolResult?.choices[0].delta.tool_calls[0].function.arguments).toContain("pong");

    // Ensure converter output still present
    expect(sse.length).toBeGreaterThan(0);
  });
});

/**
 * Build a text prompt from OpenAI chat messages + tool definitions.
 * Handles role:"tool" result messages and assistant tool_calls that
 * plain text flattening would silently drop.
 */
export function buildPromptFromMessages(messages: Array<any>, tools: Array<any>): string {
  const lines: string[] = [];

  if (tools.length > 0) {
    const toolDescs = tools
      .map((t: any) => {
        const fn = t.function || t;
        const name = fn.name || "unknown";
        const desc = fn.description || "";
        const params = fn.parameters;
        const paramStr = params ? JSON.stringify(params) : "{}";
        return `- ${name}: ${desc}\n  Parameters: ${paramStr}`;
      })
      .join("\n");
    lines.push(
      `SYSTEM: You have access to the following tools. When you need to use one, respond with a tool_call in the standard OpenAI format.\n` +
        `Tool guidance: prefer write/edit for file changes; use bash mainly to run commands/tests.\n\nAvailable tools:\n${toolDescs}`,
    );
  }

  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "user";

    // tool result messages (from multi-turn tool execution loop)
    if (role === "tool") {
      const callId = message.tool_call_id || "unknown";
      const body =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content ?? "");
      lines.push(`TOOL_RESULT (call_id: ${callId}): ${body}`);
      continue;
    }

    // assistant messages that contain tool_calls (previous turn's tool invocations)
    if (
      role === "assistant" &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      const tcTexts = message.tool_calls.map((tc: any) => {
        const fn = tc.function || {};
        return `tool_call(id: ${tc.id || "?"}, name: ${fn.name || "?"}, args: ${fn.arguments || "{}"})`;
      });
      const text = typeof message.content === "string" ? message.content : "";
      lines.push(`ASSISTANT: ${text ? text + "\n" : ""}${tcTexts.join("\n")}`);
      continue;
    }

    // standard text messages
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

  return lines.join("\n\n");
}

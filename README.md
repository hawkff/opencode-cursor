![header](docs/header.png)

<p align="center">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS" />
</p>

No prompt limits. No broken streams. Full thinking + tool support in OpenCode. Your Cursor subscription, properly integrated.

## Prerequisites

Required: [OpenCode](https://opencode.ai/) + [cursor-agent](https://cursor.com/) (`curl -fsSL https://cursor.com/install | bash && cursor-agent login`)
Optional: [Bun](https://bun.sh/) (Options B-F), [Go 1.21+](https://go.dev/) (Option D)

## Installation

### Option A — One-line installer

```bash
curl -fsSL https://raw.githubusercontent.com/Nomadcxx/opencode-cursor/main/install.sh | bash
```

### Option B — Add to opencode.json

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@rama_nigg/open-cursor@latest"],
  "provider": {
    "cursor-acp": {
      "name": "Cursor ACP",
      "npm": "@ai-sdk/openai-compatible",
      "models": {
        "cursor-acp/auto": { "name": "Auto" },
        "cursor-acp/composer-1.5": { "name": "Composer 1.5" },
        "cursor-acp/composer-1": { "name": "Composer 1" },
        "cursor-acp/gpt-5.3-codex": { "name": "GPT-5.3 Codex" },
        "cursor-acp/gpt-5.3-codex-low": { "name": "GPT-5.3 Codex Low" },
        "cursor-acp/gpt-5.3-codex-high": { "name": "GPT-5.3 Codex High" },
        "cursor-acp/gpt-5.3-codex-xhigh": { "name": "GPT-5.3 Codex Extra High" },
        "cursor-acp/gpt-5.3-codex-fast": { "name": "GPT-5.3 Codex Fast" },
        "cursor-acp/gpt-5.3-codex-low-fast": { "name": "GPT-5.3 Codex Low Fast" },
        "cursor-acp/gpt-5.3-codex-high-fast": { "name": "GPT-5.3 Codex High Fast" },
        "cursor-acp/gpt-5.3-codex-xhigh-fast": { "name": "GPT-5.3 Codex Extra High Fast" },
        "cursor-acp/gpt-5.2": { "name": "GPT-5.2" },
        "cursor-acp/gpt-5.2-codex": { "name": "GPT-5.2 Codex" },
        "cursor-acp/gpt-5.2-codex-high": { "name": "GPT-5.2 Codex High" },
        "cursor-acp/gpt-5.2-codex-low": { "name": "GPT-5.2 Codex Low" },
        "cursor-acp/gpt-5.2-codex-xhigh": { "name": "GPT-5.2 Codex Extra High" },
        "cursor-acp/gpt-5.2-codex-fast": { "name": "GPT-5.2 Codex Fast" },
        "cursor-acp/gpt-5.2-codex-high-fast": { "name": "GPT-5.2 Codex High Fast" },
        "cursor-acp/gpt-5.2-codex-low-fast": { "name": "GPT-5.2 Codex Low Fast" },
        "cursor-acp/gpt-5.2-codex-xhigh-fast": { "name": "GPT-5.2 Codex Extra High Fast" },
        "cursor-acp/gpt-5.1-codex-max": { "name": "GPT-5.1 Codex Max" },
        "cursor-acp/gpt-5.1-codex-max-high": { "name": "GPT-5.1 Codex Max High" },
        "cursor-acp/opus-4.6-thinking": { "name": "Claude 4.6 Opus (Thinking)" },
        "cursor-acp/sonnet-4.5-thinking": { "name": "Claude 4.5 Sonnet (Thinking)" },
        "cursor-acp/gpt-5.2-high": { "name": "GPT-5.2 High" },
        "cursor-acp/opus-4.6": { "name": "Claude 4.6 Opus" },
        "cursor-acp/opus-4.5": { "name": "Claude 4.5 Opus" },
        "cursor-acp/opus-4.5-thinking": { "name": "Claude 4.5 Opus (Thinking)" },
        "cursor-acp/sonnet-4.5": { "name": "Claude 4.5 Sonnet" },
        "cursor-acp/gpt-5.1-high": { "name": "GPT-5.1 High" },
        "cursor-acp/gemini-3-pro": { "name": "Gemini 3 Pro" },
        "cursor-acp/gemini-3-flash": { "name": "Gemini 3 Flash" },
        "cursor-acp/grok": { "name": "Grok" }
      }
    }
  }
}
```

> Update models anytime: `cursor-agent models`

### Option C — npm global + CLI

```bash
npm install -g @rama_nigg/open-cursor
open-cursor install
```

Upgrade: `npm update -g @rama_nigg/open-cursor`

### Option D — Go TUI installer

```bash
git clone https://github.com/Nomadcxx/opencode-cursor.git
cd opencode-cursor
go build -o ./installer ./cmd/installer && ./installer
```

### Option E — LLM paste

```
Install open-cursor for OpenCode: edit ~/.config/opencode/opencode.json, add "@rama_nigg/open-cursor@latest" to "plugin", add a "cursor-acp" provider with npm "@ai-sdk/openai-compatible" and models from `cursor-agent models` prefixed with "cursor-acp/". Auth: `cursor-agent login`. Verify: `opencode models | grep cursor-acp`.
```

### Option F — Manual (from source)

```bash
git clone https://github.com/Nomadcxx/opencode-cursor.git && cd opencode-cursor
bun install && bun run build
ln -sf $(pwd)/dist/plugin-entry.js ~/.config/opencode/plugin/cursor-acp.js
./scripts/sync-models.sh
```

Add `"cursor-acp"` to the `plugin` array and reuse the provider block from Option B.

## Authentication

```bash
opencode auth login   # provider id: cursor-acp
cursor-agent login    # direct
```

## Usage

```bash
opencode run "your prompt" --model cursor-acp/auto
opencode run "your prompt" --model cursor-acp/sonnet-4.5
```

## Architecture

```mermaid
flowchart TB
    OC["OpenCode"] --> SDK["@ai-sdk/openai-compatible"]
    SDK -->|"POST /v1/chat/completions"| PROXY["open-cursor proxy :32124"]
    PROXY -->|"spawn per request"| AGENT["cursor-agent --output-format stream-json"]
    AGENT -->|"HTTPS"| CURSOR["Cursor API"]
    CURSOR --> AGENT

    AGENT -->|"assistant / thinking events"| SSE["SSE content chunks"]
    AGENT -->|"tool_call event"| BOUNDARY["Provider boundary (v1 default)"]
    BOUNDARY --> COMPAT["Schema compat + alias normalization"]
    COMPAT --> GUARD["Tool-loop guard"]
    GUARD -->|"emit tool_calls + finish_reason=tool_calls"| SDK
    SDK --> OC

    OC -->|"execute tool locally"| TOOLRUN["OpenCode tool runtime"]
    TOOLRUN -->|"next request includes role:tool result"| SDK
    SDK -->|"TOOL_RESULT prompt block"| AGENT
```

Default mode: `CURSOR_ACP_TOOL_LOOP_MODE=opencode`. Legacy `proxy-exec` still available. Details: [docs/architecture/runtime-tool-loop.md](docs/architecture/runtime-tool-loop.md).

## Roadmap

The current architecture works, but it's a translation layer held together with duct tape. cursor-agent doesn't speak OpenCode's tool protocol, so we flatten everything into text, intercept SSE streams, maintain ~50 tool name aliases, and fingerprint calls to guard against loops. It's complex because two systems weren't designed to talk to each other, and we're the interpreter in the middle.

The goal is to move from text serialisation to structured protocols. cursor-agent supports MCP natively, and we already have the beginnings of ACP internally.

### Phase 1 — Stabilise current architecture *(in progress)*

- [x] Isolated plugin entry point (fix class constructor crash)
- [x] MCP tool passthrough (unknown tools forwarded to cursor-agent, not dropped)
- [x] Toast notifications for passed-through MCP tools
- [x] Tool loop guard fix (stop inflating counts from stripped history)
- [ ] Remove dead proxy-exec code (~500 LOC cleanup)
- [ ] Fix pre-existing test isolation issue in integration suite
- [ ] Activate dormant ACP modules (SessionManager, MetricsTracker) — wired and tested but not connected to plugin

### Phase 2 — MCP server for OpenCode tools

Build an MCP server that exposes OpenCode's tools (read, write, edit, bash, ls, etc.) as structured MCP tools. cursor-agent discovers and calls them directly via MCP protocol instead of us embedding tool definitions in text prompts.

- [ ] Design MCP server tool surface (map OpenCode tools → MCP tool definitions)
- [ ] Build MCP server process (stdio transport for local use)
- [ ] Register via `.cursor/mcp.json` configuration
- [ ] Integration tests: cursor-agent discovering and calling tools via MCP
- [ ] Update installer to configure MCP server alongside plugin

### Phase 3 — Simplify the plugin

With tools flowing through MCP, the plugin's interception layer shrinks dramatically. No more text serialisation of tool definitions, no more SSE extraction of tool calls, no more alias mappings.

- [ ] Remove prompt-builder tool serialisation (tools come via MCP now)
- [ ] Remove tool name alias table (~50 mappings)
- [ ] Simplify runtime interception (only conversation relay, not tool extraction)
- [ ] Move loop guard to MCP layer (clean structured calls, not inferred from stream)
- [ ] Keep text-mode fallback for users who can't configure MCP

### Phase 4 — Full ACP + MCP

Formalise the agent boundary. cursor-agent is an ACP provider with proper session management, metrics, and structured tool updates. MCP handles all tool communication.

- [ ] ACP session lifecycle (SessionManager active, tracks conversations)
- [ ] ACP metrics (MetricsTracker active, token/call/duration tracking)
- [ ] ACP tool updates via ToolMapper feed into OpenCode's UI
- [ ] End state: plugin is a thin ACP relay, tools flow through MCP, no text serialisation

```
End state:

OpenCode ←→ [ACP relay plugin] ←→ cursor-agent
                                       ↕
                                  [MCP server]
                                       ↕
                               OpenCode tool runtime
```

## Alternatives

|                   |        open-cursor         | [yet-another-opencode-cursor-auth](https://github.com/Yukaii/yet-another-opencode-cursor-auth) | [opencode-cursor-auth](https://github.com/POSO-PocketSolutions/opencode-cursor-auth) | [cursor-opencode-auth](https://github.com/R44VC0RP/cursor-opencode-auth) |
| ----------------- | :------------------------: | :--------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------: | :----------------------------------------------------------------------: |
| **Architecture**  | HTTP proxy via cursor-agent |                                       Direct Connect-RPC                                       |                             HTTP proxy via cursor-agent                              |                       Direct Connect-RPC/protobuf                        |
| **Platform**      |       Linux, macOS         |                                          Linux, macOS                                          |                                     Linux, macOS                                     |                          macOS only (Keychain)                           |
| **Max Prompt**    |   Unlimited (HTTP body)    |                                            Unknown                                             |                                   ~128KB (ARG_MAX)                                   |                                 Unknown                                  |
| **Streaming**     |           ✓ SSE            |                                             ✓ SSE                                              |                                     Undocumented                                     |                                    ✓                                     |
| **Error Parsing** |   ✓ (quota/auth/model)     |                                               ✗                                                |                                          ✗                                           |                              Debug logging                               |
| **Installer**     |     ✓ TUI + one-liner      |                                               ✗                                                |                                          ✗                                           |                                    ✗                                     |
| **OAuth Flow**    |  ✓ OpenCode integration    |                                            ✓ Native                                            |                                    Browser login                                     |                                 Keychain                                 |
| **Tool Calling**  | ✓ OpenCode-owned loop + proxy-exec |                                            ✓ Native                                            |                                    ✓ Experimental                                    |                                    ✗                                     |
| **Stability**     | Stable (uses official CLI) |                                          Experimental                                          |                                        Stable                                        |                               Experimental                               |
| **Dependencies**  |     bun, cursor-agent      |                                              npm                                               |                                  bun, cursor-agent                                   |                               Node.js 18+                                |
| **Port**          |           32124            |                                             18741                                              |                                        32123                                         |                                   4141                                   |

## Troubleshooting

- `fetch() URL is invalid` → `opencode auth login`
- Model not responding → `cursor-agent login`
- Quota exceeded → [cursor.com/settings](https://cursor.com/settings)
- Auth failed → `CURSOR_ACP_LOG_LEVEL=debug opencode auth login cursor-acp`

Debug logging: `CURSOR_ACP_LOG_LEVEL=debug opencode run "your prompt" --model cursor-acp/auto`

## License

BSD-3-Clause

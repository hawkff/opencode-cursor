![header](docs/header.png)

A lightweight OpenCode plugin that bridges to Cursor CLI via HTTP proxy. No E2BIG errors, full streaming support, 30+ models.

## Installation

**One-Line Install:**

```bash
curl -fsSL https://raw.githubusercontent.com/Nomadcxx/opencode-cursor/main/install.sh | bash
```

**Quick Install (Go TUI Installer):**

```bash
git clone https://github.com/Nomadcxx/opencode-cursor.git
cd opencode-cursor
./cmd/installer/installer-binary
```

**Manual Install:**

```bash
bun install
bun run build
ln -s $(pwd)/dist/index.js ~/.config/opencode/plugin/cursor-acp.js
```

Then add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-cursor"],
  "provider": {
    "cursor-acp": {
      "name": "Cursor",
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://127.0.0.1:32124/v1" }
    }
  }
}
```

## Usage

```bash
# Run with auto model
opencode run "your prompt" --model cursor-acp/auto

# Or select specific model
opencode run "your prompt" --model cursor-acp/sonnet-4.5
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CURSOR_ACP_LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `CURSOR_ACP_LOG_SILENT` | `false` | Set to `1` to disable all logging |

### Auth Status

Check your authentication status:
```bash
# Via exported function
node -e "const { formatStatusOutput } = require('opencode-cursor'); console.log(formatStatusOutput())"
```

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime
- [cursor-agent](https://cursor.com/) - Cursor CLI (`curl -fsSL https://cursor.com/install | bash`)

## How It Works

1. Plugin starts HTTP proxy server on port 32124
2. OpenCode sends requests to proxy via `@ai-sdk/openai-compatible`
3. Proxy spawns `cursor-agent` for each request
4. cursor-agent streams responses back through proxy

## Models

Available models include:
- `cursor-acp/auto` - Auto-select best available
- `cursor-acp/sonnet-4.5` - Claude 4.5 Sonnet
- `cursor-acp/opus-4.5` - Claude 4.5 Opus
- `cursor-acp/gpt-5.2` - GPT-5.2
- `cursor-acp/gemini-3-pro` - Gemini 3 Pro
- ... and 25+ more

## Features

- HTTP proxy mode (no CLI argument limits)
- Full streaming support
- Tool calling support
- Auto model discovery
- Go TUI installer with progress tracking

## License

BSD-3-Clause

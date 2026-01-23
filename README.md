![header](docs/header.png)

A lightweight OpenCode plugin for Cursor Agent integration via stdin (fixes E2BIG errors).

## Installation

**Quick install**:

```bash
curl -fsSL https://raw.githubusercontent.com/nomadcxx/opencode-cursor/main/install.sh | bash
```

**Manual install**:

```bash
git clone https://github.com/nomadcxx/opencode-cursor.git
cd opencode-cursor
bun install && bun run build
cd ~/.config/opencode && bun add @agentclientprotocol/sdk@^0.13.1
mkdir -p ~/.config/opencode/plugin
ln -s $(pwd)/dist/index.js ~/.config/opencode/plugin/cursor-acp.js
```

Add to `~/.config/opencode/opencode.json`:

```json
{
  "provider": {
    "cursor-acp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Cursor Agent (ACP stdin)",
      "options": {
        "baseURL": "http://127.0.0.1:32123/v1"
      }
    }
  }
}
```

**Note**: The plugin externalizes ACP SDK to avoid Bun's segfault bug with large bundles. ACP SDK is installed to `~/.config/opencode/node_modules/`.

## Usage

Select `cursor-acp/auto` as your model in OpenCode.

## Features

- stdin/stdout communication (no E2BIG argument limit errors)
- Full streaming support
- Tool calling support
- ACP protocol (works with OpenCode, Zed, JetBrains, neovim)
- Session persistence
- Automatic retry with exponential backoff

## Why This Approach

CLI argument passing fails with E2BIG errors. HTTP proxies add daemon overhead. This plugin uses stdin/stdout for simple, direct communication.

## Prerequisites

- bun
- cursor-agent
- Go 1.21+ (installer)

## Development

```bash
bun install
bun run build  # or bun run dev for watch mode
./install.sh --debug
```

## License

ISC

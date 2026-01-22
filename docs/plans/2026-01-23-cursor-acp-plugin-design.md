# OpenCode-Cursor Plugin Design

## Overview

Two deliverables:
1. **Plugin fixes** - Fix bugs in existing `src/index.ts`
2. **Go TUI Installer** - Bubbletea installer with beams ASCII animation (ported from jellywatch)

## Plugin Fixes (10 total)

### Bug 1: Streaming logic (`src/index.ts:132-144`)
Final chunk with `finish_reason: "stop"` sent inside loop - move outside.

### Bug 2: Message formatting (`src/index.ts:58-62`)
Naive `role: content` concatenation - use proper conversation format with delimiters.

### Bug 3: Error handling
Mixed patterns - unify with consistent `throw new Error()` and context.

### Bug 4: Tool execution stub (`src/index.ts:200-210`)
Echoes input args - remove or implement proper pass-through.

### Bug 5: Double command name (`src/index.ts:65-76`)
`spawn("cursor-agent", ["cursor-agent", ...])` duplicates command - remove from args.

### Bug 6: Chunk boundary JSON parsing
Splits on `\n` without buffering - add line buffer for partial chunks.

### Bug 7: No timeout
Hangs forever if cursor-agent blocks - add configurable timeout.

### Bug 8: Orphaned child process
No cleanup on cancel - add signal handlers and `child.kill()`.

### Bug 9: Unused `chat.message` hook
Just passes through - remove entirely.

### Bug 10: Export shape
Verify OpenCode expects named export `cursorACP` vs default export.

## Installer Architecture

### Directory Structure
```
cmd/installer/
├── main.go          # Bubbletea setup, model, Init/Update
├── view.go          # Render functions for each screen
├── animations.go    # BeamsTextEffect (ported from jellywatch)
├── tasks.go         # Install task execution
├── theme.go         # Colors, styles, ASCII header
```

### Source: Jellywatch Installer
Port directly from `/home/nomadx/Documents/jellywatch/cmd/installer/`:
- `animations.go` - BeamsTextEffect + TypewriterTicker (use as-is, ~650 lines)
- `theme.go` - Monochrome color scheme (adapt header only)
- `main.go` - Bubbletea model pattern (simplify screens)
- `view.go` - Render pattern (simplify to 3 screens)

### ASCII Header
From `/home/nomadx/bit/CURSOR.txt`:
```
▄███████▄ ████████▄ █████████ ███▄    ██           ▄██████▄ ██     ██ ████████▄ ▄███████   ▄███████▄  ████████▄
██     ██ ██     ██ ██        ██▀██▄  ██          ██▀    ▀▀ ██     ██ ██     ██ ██         ██     ██  ██     ██
██     ██ ████████▀ ███████   ██  ██▄ ██ ████████ ██        ██     ██ ████████▀ ▀███████▄  ██     ██  ████████▀
██     ██ ██        ██        ██   ▀█▄██          ██▄    ▄▄ ██     ██ ██ ▀██▄          ██  ██     ██  ██ ▀██▄
▀███████▀ ██        █████████ ██    ▀███           ▀██████▀ ▀███████▀ ██   ▀███  ███████▀  ▀███████▀  ██   ▀███
```

### Screens (3 total)

| Screen | Purpose |
|--------|---------|
| `welcome` | Animated header, "Install" option, Enter to start |
| `installing` | Task list with spinner/checkmarks |
| `complete` | Success + usage instructions, or error details |

### Pre-install Checks

| Check | Action if fails |
|-------|-----------------|
| `bun` available | Error: "Install bun: curl -fsSL https://bun.sh/install \| bash" |
| `cursor-agent` installed | Error: "Install cursor-agent: curl -fsS https://cursor.com/install \| bash" |
| `cursor-agent` logged in | Warning: "Run `cursor-agent login` after install" (non-blocking) |
| OpenCode config dir exists | Create `~/.config/opencode/` if missing |
| `opencode.json` exists | Create minimal valid JSON if missing |
| Existing `cursor-acp` provider | Prompt: "Already configured. Reinstall?" |

### Install Tasks (4 total)

1. **Check prerequisites** - Verify cursor-agent, bun available
2. **Build plugin** - `bun install && bun run build`
3. **Create symlink** - `~/.config/opencode/plugin/cursor-acp.js` → `dist/index.js`
4. **Update opencode.json** - Append cursor-acp provider, validate JSON

### Post-install Validations

| Validation | How |
|------------|-----|
| Build succeeded | Check `dist/index.js` exists and non-empty |
| Symlink valid | `os.Stat` resolves symlink target |
| JSON syntax valid | `json.Unmarshal` modified config |
| Provider registered | Parse JSON, verify `cursor-acp` in `provider` |
| Plugin loadable | `node -e "require('./dist/index.js')"` |
| cursor-agent responds | `cursor-agent --version` exit code 0 |

## Entry Point

**`install.sh`** (project root):
```bash
#!/bin/bash
set -e
echo "Building installer..."
cd "$(dirname "$0")"
go build -o /tmp/opencode-cursor-installer ./cmd/installer
/tmp/opencode-cursor-installer "$@"
```

## Key Paths

| Path | Purpose |
|------|---------|
| Project root | `/home/nomadx/opencode-cursor` |
| Built plugin | `dist/index.js` |
| Symlink target | `~/.config/opencode/plugin/cursor-acp.js` |
| OpenCode config | `~/.config/opencode/opencode.json` |

## Dependencies

```go
require (
    github.com/charmbracelet/bubbletea
    github.com/charmbracelet/lipgloss
    github.com/charmbracelet/bubbles/spinner
)
```

## Estimates

| Component | Files | Lines |
|-----------|-------|-------|
| Plugin fixes | `src/index.ts` | ~200 |
| Installer | `cmd/installer/*.go` | ~1100 |
| Entry script | `install.sh` | ~15 |
| **Total** | 7 files | ~1300 lines |

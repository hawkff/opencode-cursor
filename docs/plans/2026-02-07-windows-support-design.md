# Windows Support Design

**Status**: ⚠️ NOT IMPLEMENTED — Design document only  
**Date**: 2026-02-07  
**Scope**: Experimental Windows support for opencode-cursor

## Motivation

opencode-cursor currently supports Linux and macOS. Windows support is not urgent (small user base, no reported demand), but documenting a plan now captures research done while it's fresh and provides a roadmap for contributors who may want to pick this up.

## Key Insight: OpenCode Already Solves Most Platform Problems

OpenCode's framework handles the hardest cross-platform concerns at the infrastructure level:

| Concern | How OpenCode Handles It |
|---------|------------------------|
| **Config/data paths** | Uses `xdg-basedir` → maps to `%LOCALAPPDATA%` on Windows automatically |
| **Plugin discovery** | Uses `path.join` + glob everywhere — no hardcoded separators |
| **Plugin loading** | `config.plugin` array + dynamic imports — platform-agnostic |
| **Skill discovery** | Globs `agent/**/*.md` from config dirs — uses `path.join` |
| **Binary extensions** | Pattern: `process.platform === 'win32' ? '.exe' : ''` |
| **File permissions** | Pattern: `if (platform !== 'win32') chmod(...)` |

**What this means**: Our plugin doesn't need to solve platform path resolution from scratch. We just need to follow OpenCode's existing patterns and handle our cursor-specific concerns.

### Reference Patterns from OpenCode

**Binary extension** (from `lsp/server.ts`):
```typescript
const ext = process.platform === 'win32' ? '.exe' : ''
const bin = path.join(dir, `cursor-agent${ext}`)
```

**Conditional chmod** (from `lsp/server.ts`):
```typescript
if (process.platform !== 'win32') {
  await $`chmod +x ${bin}`.nothrow()
}
```

**Auth plugins** (`opencode-copilot-auth`, `opencode-anthropic-auth`):
- Pure HTTP/OAuth — no filesystem, no process spawning
- Fully platform-agnostic by design
- Shows that OpenCode's plugin API doesn't impose Unix assumptions

## Current Platform-Specific Surface Area

Every file that assumes Unix semantics:

| File | Unix Assumption | Windows Concern | Difficulty |
|------|----------------|-----------------|------------|
| `install.sh` | Bash, `ln -sf`, `chmod +x`, `~/.local/bin` | No bash by default | Medium |
| `sync-models.sh` | Bash script | Same as install.sh | Medium |
| `src/auth.ts` | `~/.cursor/auth.json`, `~/.config/cursor/auth.json` | Windows uses `%APPDATA%\Cursor\` | **Easy** — follow Vercel's pattern |
| `src/cli/discover.ts` | `homedir() + '/.config'` XDG convention | `%LOCALAPPDATA%` | **Easy** — `xdg-basedir` handles it |
| `src/proxy/server.ts` | `ss` / `lsof` for port detection | `netstat` or PowerShell | Easy |
| `src/client/simple.ts` | `SIGTERM` for process termination | No SIGTERM on Windows | Easy — `process.kill(pid)` works |
| `src/models/discovery.ts` | `spawn()` of cursor-agent | `.exe` extension needed | **Easy** — follow OpenCode's pattern |
| `src/plugin.ts` | `spawn()` / `exec()` calls | Shell differences | Easy |
| `src/tools/defaults.ts` | Various exec/spawn | Same | Easy |

**Assessment**: With OpenCode's patterns as reference, most items are straightforward. The only medium-effort items are the shell scripts (install.sh, sync-models.sh) which need a cross-platform alternative.

## Remaining Unknowns

These still require a Windows machine running Cursor to confirm:

1. **cursor-agent binary path**: Likely `%LOCALAPPDATA%\Programs\cursor\resources\app\cursor-agent.exe` but unconfirmed
2. **cursor-agent Windows behavior**: Same CLI flags? Same stdin/stdout protocol?
3. **Auth file location**: Likely `%APPDATA%\Cursor\auth.json` based on Vercel's patterns

### How to Resolve

A Windows contributor needs to run:
```powershell
# Find cursor-agent
Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\cursor" -Recurse -Filter "cursor-agent*"
Get-ChildItem -Path "$env:LOCALAPPDATA\cursor" -Recurse -Filter "cursor-agent*"

# Find auth file
Get-ChildItem -Path "$env:APPDATA\Cursor" -Recurse -Filter "auth*"
Get-ChildItem -Path "$env:LOCALAPPDATA\Cursor" -Recurse -Filter "auth*"

# Test cursor-agent
& "path\to\cursor-agent.exe" --help
```

## Implementation Plan

### Phase 1: Create `src/platform.ts` (~1 hour)

Centralized platform utilities following OpenCode's patterns:

```typescript
import path from 'path'
import os from 'os'

export function getCursorConfigDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA!, 'Cursor')
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor')
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'Cursor'
      )
  }
}

export function getCursorDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.LOCALAPPDATA!, 'cursor')
    case 'darwin':
      return path.join(os.homedir(), '.cursor')
    default:
      return path.join(os.homedir(), '.cursor')
  }
}

export function getBinaryName(name: string): string {
  return process.platform === 'win32' ? `${name}.exe` : name
}

export function getAuthPaths(): string[] {
  const config = getCursorConfigDir()
  const data = getCursorDataDir()
  return [
    path.join(data, 'auth.json'),
    path.join(config, 'auth.json'),
  ]
}
```

### Phase 2: Refactor Existing Code (~2 hours)

Replace all hardcoded paths with `platform.ts` functions:

- `auth.ts`: Use `getAuthPaths()` instead of hardcoded Unix paths
- `discover.ts`: Use `getCursorDataDir()` for cursor-agent lookup
- `client/simple.ts`: Use `process.kill(pid)` instead of `SIGTERM` (works cross-platform in Node.js)
- `proxy/server.ts`: Add Windows port detection:
  ```typescript
  if (process.platform === 'win32') {
    // netstat -ano | findstr :PORT
  } else {
    // existing ss/lsof logic
  }
  ```

### Phase 3: Cross-Platform Installation (~2 hours)

Replace bash scripts with a Node.js installer:

- Create `scripts/install.js` that handles all platforms
- npm `bin` field in `package.json` auto-generates `.cmd` shims on Windows (no symlinks needed)
- Keep `install.sh` as thin wrapper calling `node scripts/install.js` for backward compat
- `sync-models.sh` → `scripts/sync-models.js`

### Phase 4: Testing (~1 hour)

- Add `process.platform` mocking to existing test suite
- Add Windows-specific path resolution tests
- CI: Add `windows-latest` to GitHub Actions matrix
- Note: Integration tests still require Cursor installed — Windows CI covers unit tests only

## Rollout Strategy

Ship as **experimental** behind an environment variable:

```
OPENCODE_CURSOR_EXPERIMENTAL_WINDOWS=1
```

- README gets a "Windows (Experimental)" section
- Platform badge added alongside Linux/macOS
- Issue template for Windows bug reports
- Remove experimental flag once 2-3 users confirm it works

## Effort Estimate

| Phase | Effort | Blocked On |
|-------|--------|------------|
| Phase 1: `platform.ts` | ~1 hour | Nothing — can implement now |
| Phase 2: Refactor | ~2 hours | Phase 1 |
| Phase 3: Installation | ~2 hours | Phase 1 |
| Phase 4: Testing | ~1 hour | Phases 1-3 |
| **Total** | **~6 hours** | **Windows contributor for validation** |

> Previous estimate was ~12 hours. Reduced by 50% after discovering OpenCode's existing cross-platform infrastructure.

## Decision Log

- **2026-02-07**: Initial design drafted at ~12 hour estimate. Revised after studying OpenCode's cross-platform patterns (xdg-basedir, LSP server binary handling, auth plugin architecture). Most path resolution is handled by the framework — our plugin just needs to follow established patterns. Revised estimate: ~6 hours.

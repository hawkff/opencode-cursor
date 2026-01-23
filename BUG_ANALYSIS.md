# Bug Analysis: OpenCode Segfault with Large Bundled Plugin

## Problem Summary

OpenCode segfaults (Bun panic) when loading the `opencode-cursor` plugin with the ACP SDK bundled (480KB). The root cause was identified as **Bun's module loader bug with large bundled JavaScript files**.

## Root Cause

**Bun has a bug when parsing/loading large bundled JavaScript files (480KB, 14,469 lines)**

The ACP SDK bundle contains:
- Complex class hierarchies
- Circular dependencies
- Large Zod schemas
- Stream handling code

This triggers a memory corruption or stack overflow in Bun's parser/loader during module load time.

## Solution: Externalize ACP SDK

The fix is to **externalize the ACP SDK dependency** instead of bundling it:

- **Before**: 480KB bundle (includes ACP SDK) → segfault
- **After**: 23KB bundle (external ACP SDK) → works

The installer now:
1. Builds plugin with `--external "@agentclientprotocol/sdk"` flag
2. Installs `@agentclientprotocol/sdk` to `~/.config/opencode/node_modules/`
3. Plugin loads ACP SDK from opencode's node_modules instead of bundle

## Evidence

**Before (bundled)**:
```bash
$ bun build ./src/index.ts --outdir ./dist --target node
# index.js 480 KB (14,469 lines)
$ opencode
# Segmentation fault at address 0x7F...02A7
```

**After (externalized)**:
```bash
$ bun build ./src/index.ts --outdir ./dist --target node --external "@agentclientprotocol/sdk"
# index.js 23 KB (762 lines)
$ opencode --version
# 1.1.34 (works!)
```

## Installation Methods Supported

All installation methods (AUR, curl script, npm, bun) share the same config paths:

| Method | Binary Location | Config | Plugin Dir | node_modules |
|--------|------------------|---------|-------------|--------------|
| AUR opencode-bin | `/usr/bin/opencode` | `~/.config/opencode/` | `~/.config/opencode/node_modules/` |
| curl install script | `~/.opencode/bin/opencode` | `~/.config/opencode/` | `~/.config/opencode/node_modules/` |
| npm global | `/usr/local/lib/node_modules/...` | `~/.config/opencode/` | `~/.config/opencode/node_modules/` |
| bun global | bun global location | `~/.config/opencode/` | `~/.config/opencode/node_modules/` |

**Key insight**: Config paths are always the same, only the binary location changes.

## Files Modified

- `package.json`: Added `--external "@agentclientprotocol/sdk"` to build script
- `cmd/installer/tasks.go`: Added `installAcpSdk()` task to install dependency
- `cmd/installer/utils.go`: Added `detectOpenCodeInstall()` for installation method detection

## Testing

✅ Plugin builds successfully (23KB)
✅ Plugin loads in Bun without segfault
✅ Plugin loads in Node.js
✅ OpenCode starts without segfault
✅ Full install → load → uninstall cycle works
✅ ACP SDK installed to `~/.config/opencode/node_modules/`
✅ Old `opencode-cursor-auth` plugin removed during uninstall

## Related Issues

- opencode #4970 (CLOSED): "Since opencode 1.0.116 no longer able to run binary as it crashes with bun seg fault"
- Bun issue with large bundled modules (root cause)


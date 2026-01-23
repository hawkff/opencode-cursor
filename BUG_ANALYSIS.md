# Bug Analysis: OpenCode Segfault with Large Bundled Plugin

## Problem Summary

OpenCode segfaults (Bun panic) when loading the `opencode-cursor` plugin, even though:
- ✅ Plugin structure matches working plugins (opencode-notifier, opencode-gemini-auth)
- ✅ Plugin loads correctly in Node.js
- ✅ Plugin exports are correct (named + default exports)
- ✅ No hook.config or constructor errors
- ✅ Plugin function works when called directly

## Exact Error

```
panic(main thread): Segmentation fault at address 0x7F...02A7
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

**When it happens:**
- Immediately when opencode starts (before any user interaction)
- Only when the plugin is loaded (works fine without plugin)
- Both AUR binary (`/usr/bin/opencode`) and install script version (`~/.opencode/bin/opencode`)
- Both use Bun v1.3.5

## What We Know Works

1. **Plugin Structure**: Matches working plugins exactly:
   - Named export: `export const CursorAcpPlugin: Plugin = ...`
   - Default export: `export default CursorAcpPlugin`
   - Returns proper `Hooks` object with `config` hook

2. **Node.js Loading**: Plugin loads fine in Node.js:
   ```bash
   node -e "const m = require('./dist/index.js'); console.log(m.default);"
   # Works perfectly
   ```

3. **Plugin Function**: Works when called:
   ```bash
   node -e "const m = require('./dist/index.js'); (async () => { const hooks = await m.default({...}); console.log(hooks); })();"
   # Returns hooks object correctly
   ```

4. **ES Module Loading**: Works in Node.js ESM:
   ```bash
   node --input-type=module -e "import('./dist/index.js').then(m => ...)"
   # Works fine
   ```

## What We Know Doesn't Work

1. **Bun/OpenCode Loading**: Segfaults when Bun loads the plugin
2. **Only with large bundle**: When ACP SDK is bundled (480KB), segfaults occur
3. **When externalized**: If ACP SDK is externalized (23KB bundle), haven't tested yet

## Key Differences from Working Plugins

| Aspect | Working Plugins | Our Plugin |
|--------|----------------|------------|
| Bundle size | ~5KB source | 480KB compiled (14,469 lines) |
| Dependencies | Small npm packages | Entire `@agentclientprotocol/sdk` bundled |
| Format | TypeScript or small JS | Large bundled JavaScript |
| ACP SDK | N/A | Full ACP SDK bundled inline |

## Hypothesis: Root Cause

**Primary Hypothesis: Bun's module loader has a bug with large bundled modules**

The segfault likely occurs because:

1. **Bundle Size**: Our plugin is 480KB (vs ~5KB for working plugins)
   - Bun's module loader might have issues with large bundled files
   - Could be a memory allocation bug
   - Could be a parsing/transpilation bug with large files

2. **ACP SDK Complexity**: The bundled ACP SDK includes:
   - Complex class hierarchies
   - Circular dependencies (possibly)
   - Large Zod schemas
   - Stream handling code
   - Something in this code might trigger a Bun bug

3. **Module Format**: The bundle uses ES modules internally but is compiled to CJS
   - Bun might have issues with the module format conversion
   - The `__toESM` helper functions might cause issues

4. **Timing**: Segfault happens at module load time, not runtime
   - Suggests it's during Bun's parsing/loading phase
   - Not during plugin function execution

## Evidence Supporting Hypothesis

1. **No plugin-specific segfault issues found** in opencode repo
   - Suggests this is unique to large bundles
   - Other plugins are much smaller

2. **Works in Node.js but not Bun**
   - Node.js handles the bundle fine
   - Bun-specific issue

3. **Segfault happens before plugin function is called**
   - Error occurs during opencode startup
   - Plugin function itself works when tested

4. **Bundle size correlation**
   - 480KB bundled = segfault
   - 23KB externalized = unknown (not tested)

## Investigation Steps for Another Agent

### Step 1: Test Externalized ACP SDK
```bash
cd /home/nomadx/opencode-cursor
bun build ./src/index.ts --outdir ./dist --target node --external "@agentclientprotocol/sdk"
# This creates a 23KB bundle that requires ACP SDK from node_modules
# Test if opencode can load it (might need to install @agentclientprotocol/sdk in opencode's node_modules)
```

### Step 2: Create Minimal Reproducer
Create a minimal plugin that just imports ACP SDK:
```typescript
// test-plugin.ts
import { AgentSideConnection } from "@agentclientprotocol/sdk";
export default async () => ({ config: async () => {} });
```
Build and test if this also segfaults.

### Step 3: Test Bundle Size Threshold
Create plugins of increasing sizes to find the threshold:
- 50KB bundle
- 100KB bundle  
- 200KB bundle
- 480KB bundle (current)

### Step 4: Check Bun Version
```bash
# Test with different Bun versions
bun --version  # Currently 1.3.5
# Try with Bun 1.3.6 or latest
```

### Step 5: Analyze Bundle Contents
```bash
# Check what's in the bundle
cd /home/nomadx/opencode-cursor
head -100 dist/index.js  # Check imports
grep -c "class\|function" dist/index.js  # Count classes/functions
grep "circular\|Circular" dist/index.js  # Check for circular deps
```

### Step 6: Test with Bun Debug
```bash
# Run opencode with Bun debug flags
BUN_DEBUG=1 opencode 2>&1 | tee debug.log
# Look for clues in the debug output
```

### Step 7: Check Bun Issues
- Search Bun repo for issues about:
  - Large bundled modules
  - Segfaults with bundled dependencies
  - ACP SDK or @agentclientprotocol/sdk issues
  - Module loading segfaults

### Step 8: Test Alternative Bundle Formats
```bash
# Try different build targets
bun build ./src/index.ts --outdir ./dist --target bun
bun build ./src/index.ts --outdir ./dist --target node --format esm
bun build ./src/index.ts --outdir ./dist --target node --format cjs --minify
```

### Step 9: Profile Memory Usage
```bash
# Check memory usage during load
valgrind --tool=memcheck opencode 2>&1 | head -50
# Or use Bun's built-in profiling
```

### Step 10: Compare with Working Plugin Bundle
```bash
# Check how opencode-notifier bundles (if it does)
# Compare bundle structure
```

## Most Likely Root Cause

**Bun's module loader has a bug when parsing/loading large bundled JavaScript files (480KB+).**

The ACP SDK bundle likely contains something that triggers a memory corruption or stack overflow in Bun's parser/loader, causing the segfault.

## Recommended Fix Strategy

1. **Short-term**: Externalize ACP SDK (if opencode can load from node_modules)
2. **Medium-term**: Split bundle into smaller chunks
3. **Long-term**: Report to Bun with minimal reproducer

## Files to Investigate

- `dist/index.js` - The 480KB bundle that causes segfault
- `src/index.ts` - Source file
- `src/acp/agent.ts` - Uses ACP SDK
- Compare with: `/tmp/opencode-notifier/src/index.ts` (working plugin)

## Test Commands

```bash
# Test plugin in Node.js (works)
node -e "const m = require('./dist/index.js'); console.log(typeof m.default);"

# Test in Bun (segfaults)
bun run dist/index.js

# Test with opencode (segfaults)
opencode

# Test with external ACP SDK
bun build ./src/index.ts --outdir ./dist --target node --external "@agentclientprotocol/sdk"
```

## Environment

- OS: Linux (Arch) x86_64
- Bun: 1.3.5 (1e86cebd)
- OpenCode: 1.1.34
- Plugin bundle: 480KB, 14,469 lines
- ACP SDK: @agentclientprotocol/sdk@^0.13.1

## Additional Hypothesis: Multiple Installation Methods

**Potential Issue: Different installation methods might load plugins differently**

The user has multiple opencode installations:
- AUR binary: `/usr/bin/opencode` (opencode-bin 1.1.34-1)
- Install script: `~/.opencode/bin/opencode` (1.1.34)
- PATH prioritizes: `~/.opencode/bin/opencode`

**Plugin Loading Locations:**
- `~/.config/opencode/plugin/` (singular - backwards compat)
- `~/.config/opencode/plugins/` (plural - recommended)
- `.opencode/plugins/` (project-level, plural)
- npm plugins: `~/.cache/opencode/node_modules/`

**Potential Conflicts:**
1. Different binaries might use different plugin loading mechanisms
2. Multiple node_modules locations could cause module resolution issues
3. Plugin directory name confusion (singular vs plural)
4. AUR vs install script might have different Bun versions or configurations

**Investigation Needed:**
- Check if AUR binary uses different plugin loading
- Verify which node_modules location is used for plugin dependencies
- Test if moving plugin to `plugins/` (plural) helps
- Check if different installation methods have different Bun runtimes

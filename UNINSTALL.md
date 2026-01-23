# Uninstall OpenCode-Cursor Plugin

## Manual Uninstall Steps

To completely remove the opencode-cursor plugin:

### 1. Remove Plugin Symlink
```bash
rm -f ~/.config/opencode/plugin/cursor-acp.js
```

### 2. Remove Provider from Config
Edit `~/.config/opencode/opencode.json` and remove the `cursor-acp` entry from the `provider` section:

**Before:**
```json
{
  "provider": {
    "cursor-acp": {
      "name": "Cursor Agent (ACP stdin)",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://127.0.0.1:32123/v1"
      }
    },
    ...
  }
}
```

**After:**
```json
{
  "provider": {
    ...
  }
}
```

### 3. Verify Removal
```bash
# Check symlink is gone
ls -la ~/.config/opencode/plugin/cursor-acp.js
# Should show: No such file or directory

# Verify opencode works
opencode --version
# Should work without errors
```

## Quick Uninstall Command

```bash
# Remove symlink
rm -f ~/.config/opencode/plugin/cursor-acp.js

# Remove provider from config (requires jq)
jq 'del(.provider["cursor-acp"])' ~/.config/opencode/opencode.json > /tmp/opencode.json && mv /tmp/opencode.json ~/.config/opencode/opencode.json

# Or manually edit the file to remove the cursor-acp provider section
```

## What Gets Removed

- ✅ Plugin symlink: `~/.config/opencode/plugin/cursor-acp.js`
- ✅ Provider config: `cursor-acp` entry in `~/.config/opencode/opencode.json`

## What Stays

- ✅ Project directory (if you cloned it)
- ✅ Built files in `dist/` directory
- ✅ Other OpenCode plugins and config

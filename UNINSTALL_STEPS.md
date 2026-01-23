# Uninstall Steps for Another Agent

## Exact Steps to Uninstall OpenCode-Cursor Plugin

### Step 1: Remove Plugin Symlink
```bash
rm -f ~/.config/opencode/plugin/cursor-acp.js
```

### Step 2: Remove Provider from Config
Edit `~/.config/opencode/opencode.json` and remove the `cursor-acp` entry from the `provider` section.

**Quick method using jq (if installed):**
```bash
jq 'del(.provider["cursor-acp"])' ~/.config/opencode/opencode.json > /tmp/opencode.json && mv /tmp/opencode.json ~/.config/opencode/opencode.json
```

**Manual method:**
1. Open `~/.config/opencode/opencode.json` in an editor
2. Find the `"cursor-acp"` entry in the `provider` section
3. Remove the entire `"cursor-acp": { ... }` block (including the comma if it's not the last item)
4. Save the file

### Step 3: Verify
```bash
# Check symlink is gone
ls -la ~/.config/opencode/plugin/cursor-acp.js
# Should show: No such file or directory

# Test opencode works
opencode --version
# Should work without segfaults
```

## What Gets Removed
- ✅ Plugin symlink: `~/.config/opencode/plugin/cursor-acp.js`
- ✅ Provider config: `cursor-acp` entry in `~/.config/opencode/opencode.json`

## What Stays
- ✅ Project directory (if cloned)
- ✅ Built files in `dist/` directory
- ✅ Other OpenCode plugins and config

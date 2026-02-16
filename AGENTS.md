# AGENTS.md — cursor-acp (open-cursor)

## Project Overview

OpenCode plugin enabling Cursor AI models via cursor-agent CLI integration.

## Critical Constraints

### GitHub Actions — NEVER Autonomous

**DO NOT without explicit user authorization:**
- Close issues
- Comment on issues
- Merge PRs
- Create PRs without user request
- Respond to GitHub discussions
- Modify issue labels or milestones

**ALWAYS ask first:** "Should I close issue #X?" / "Want me to comment on the PR?"

### npm Publishing

Publishing requires pushing a version tag. The workflow is:

```bash
npm version patch  # bumps version in package.json
git add package.json package-lock.json
git commit --no-verify -m "chore: bump version to X.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z  # triggers .github/workflows/publish.yml
```

**Never assume a merge means npm is updated.** Verify with:
```bash
npm view @rama_nigg/open-cursor version
```

### Git Commits

Always use `--no-verify` flag. The commit hook rejects AI-related terms:
- claude, anthropic, chatgpt, openai, copilot, cursor, cody, tabnine, codex
- bot, agent, gpt-[0-9], llm, ai assistant

## Architecture

### Entry Points

- `dist/plugin-entry.js` — Single default export for OpenCode plugin loader
- `dist/index.js` — Full library API (exported via `./lib` subpath)

### Key Directories

```
src/
├── plugin.ts           # Main plugin implementation
├── plugin-entry.ts     # Isolated entry point (default export only)
├── plugin-toggle.ts    # Plugin detection logic
├── provider/           # Provider boundary, runtime interception
├── proxy/              # Tool loop, streaming, delta tracking
└── tools/              # Tool executors (some orphaned, see Domain B)
```

### Tool Loop Modes

- `opencode` (default) — OpenCode executes tools, plugin forwards to cursor-agent
- `off` — No tool loop

Note: `proxy-exec` mode is deprecated/removed (see Domain B plan).

## Active Work

### Domain A: MCP Pass-Through
- **Status:** In progress
- **Plan:** `docs/plans/2026-02-16-mcp-passthrough-design.md`
- **Goal:** Forward unknown MCP tools to cursor-agent instead of dropping them

### Domain B: Proxy-Exec Removal  
- **Status:** Ready for execution
- **Plan:** `docs/plans/2026-02-16-proxy-exec-removal-plan.md`
- **Goal:** Remove dead proxy-exec code (~500 LOC)

## Testing

```bash
npm test                    # All tests
npm test -- --testPathPattern="plugin-toggle"  # Specific test
npm run build              # Build
```

## Installation Methods

Users install via:
1. **npm-based:** `@rama_nigg/open-cursor@latest` in plugin array
2. **Symlink-based:** `cursor-acp.js` → `plugin-entry.js`

Both work — `matchesPlugin()` in `plugin-toggle.ts` recognizes both names.

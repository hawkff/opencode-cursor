# [OpenCode-Cursor Plugin] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bugs in the existing TypeScript plugin and create a Go TUI installer with beams ASCII animation (ported from jellywatch).

**Architecture:** Two components - (1) TypeScript plugin fixes for streaming, message formatting, and error handling, (2) Go Bubbletea installer with 3 screens (welcome, installing, complete), beams animation, and install tasks for building, symlinking, and config updates.

**Tech Stack:** TypeScript/Bun (plugin), Go/Bubbletea/Lipgloss (installer)

---

## Task 1: Fix Double Command Name Bug

**Files:**
- Modify: `src/index.ts:65-76`

**Step 1: Read current spawn code**

Current broken code:
```typescript
const args = [
  "cursor-agent",  // BUG: command name in args
  "--print",
  "--output-format",
  stream ? "json-stream" : "json",
  "--model",
  model,
  "--workspace",
  process.cwd()
];

const child = spawn("cursor-agent", args, {  // AND in spawn
```

**Step 2: Fix by removing command from args**

```typescript
const args = [
  "--print",
  "--output-format",
  stream ? "json-stream" : "json",
  "--model",
  model,
  "--workspace",
  process.cwd()
];

const child = spawn("cursor-agent", args, {
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "remove duplicate cursor-agent from spawn args"
```

---

## Task 2: Fix Streaming Final Chunk Bug

**Files:**
- Modify: `src/index.ts:92-145`

**Step 1: Identify the bug**

Current code sends final chunk INSIDE the loop (line 132-144). It should be AFTER the loop completes.

**Step 2: Restructure streaming logic**

Replace lines 92-149 with:

```typescript
// Handle streaming responses
if (stream) {
  const encoder = new TextEncoder();
  const id = `cursor-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let buffer = "";

  for await (const chunk of child.stdout) {
    const text = new TextDecoder().decode(chunk);
    buffer += text;

    // Process complete lines only
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim() || !line.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(line.slice(6));
        const delta = data.choices?.[0]?.delta?.content;
        if (delta) {
          await output.write({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{
              index: 0,
              delta: { content: delta },
              finish_reason: null
            }]
          });
        }
      } catch {
        // Ignore parse errors for malformed chunks
      }
    }
  }

  // Send final chunk AFTER loop completes
  await output.write({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: "stop"
    }]
  });
}
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "move final stream chunk outside loop, add line buffer"
```

---

## Task 3: Fix Message Formatting

**Files:**
- Modify: `src/index.ts:58-62`

**Step 1: Replace naive concatenation**

Current:
```typescript
const prompt = messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n\n");
```

**Step 2: Use proper conversation format**

```typescript
// Format messages with clear delimiters for cursor-agent
const prompt = messages
  .map(m => {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    return `<|${role}|>\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}\n<|end|>`;
  })
  .join("\n");
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "use delimited message format for cursor-agent"
```

---

## Task 4: Fix Error Handling

**Files:**
- Modify: `src/index.ts:147-165`

**Step 1: Move stderr listener before stream processing**

**Step 2: Replace error handling section**

Add before the streaming logic (around line 80):

```typescript
let stderr = "";
child.stderr.on("data", (data) => {
  stderr += data.toString();
});

child.on("error", (err) => {
  throw new Error(`Failed to spawn cursor-agent: ${err.message}`);
});
```

**Step 3: Update exit handling**

Replace lines 159-165 with:

```typescript
const exitCode = await new Promise<number>((resolve, reject) => {
  child.on("close", resolve);
  child.on("error", reject);
});

if (exitCode !== 0) {
  throw new Error(`cursor-agent exited with code ${exitCode}${stderr ? `: ${stderr}` : ""}`);
}
```

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix: unify error handling, attach stderr listener early"
```

---

## Task 5: Add Timeout and Cleanup

**Files:**
- Modify: `src/index.ts`

**Step 1: Add timeout constant at top of file**

```typescript
const CURSOR_AGENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
```

**Step 2: Wrap spawn in timeout and cleanup logic**

Add after spawn:

```typescript
// Timeout handling
const timeoutId = setTimeout(() => {
  child.kill("SIGTERM");
}, CURSOR_AGENT_TIMEOUT);

// Cleanup on process exit
const cleanup = () => {
  clearTimeout(timeoutId);
  if (!child.killed) {
    child.kill("SIGTERM");
  }
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
```

**Step 3: Clear timeout after completion**

Add before return:

```typescript
clearTimeout(timeoutId);
process.removeListener("SIGINT", cleanup);
process.removeListener("SIGTERM", cleanup);
```

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix: add 5min timeout and cleanup for orphaned processes"
```

---

## Task 6: Remove Unused Hooks

**Files:**
- Modify: `src/index.ts:195-210`

**Step 1: Remove chat.message hook**

Delete lines 195-198:
```typescript
async "chat.message"(input, output) {
  await output.write(input);
},
```

**Step 2: Remove tool.execute hook**

Delete lines 200-210 (the entire tool.execute block) - cursor-agent handles tools internally.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "fix: remove unused chat.message and tool.execute hooks"
```

---

## Task 7: Initialize Go Module for Installer

**Files:**
- Create: `cmd/installer/`
- Create: `go.mod`
- Create: `go.sum`

**Step 1: Create directory structure**

```bash
mkdir -p cmd/installer
```

**Step 2: Initialize Go module**

```bash
cd /home/nomadx/opencode-cursor
go mod init github.com/nomadcxx/opencode-cursor
```

**Step 3: Add dependencies**

```bash
go get github.com/charmbracelet/bubbletea
go get github.com/charmbracelet/lipgloss
go get github.com/charmbracelet/bubbles/spinner
```

**Step 4: Commit**

```bash
git add go.mod go.sum cmd/
git commit -m "feat: initialize Go module for installer"
```

---

## Task 8: Create Theme (Port from Jellywatch)

**Files:**
- Create: `cmd/installer/theme.go`

**Step 1: Create theme.go**

```go
// cmd/installer/theme.go
package main

import "github.com/charmbracelet/lipgloss"

// Theme colors - Monochrome (same as jellywatch)
var (
	BgBase       = lipgloss.Color("#1a1a1a")
	BgElevated   = lipgloss.Color("#2a2a2a")
	Primary      = lipgloss.Color("#ffffff")
	Secondary    = lipgloss.Color("#cccccc")
	Accent       = lipgloss.Color("#ffffff")
	FgPrimary    = lipgloss.Color("#ffffff")
	FgSecondary  = lipgloss.Color("#cccccc")
	FgMuted      = lipgloss.Color("#666666")
	ErrorColor   = lipgloss.Color("#ff6b6b")
	WarningColor = lipgloss.Color("#888888")
	SuccessColor = lipgloss.Color("#ffffff")
)

// Styles
var (
	checkMark   = lipgloss.NewStyle().Foreground(SuccessColor).SetString("[OK]")
	failMark    = lipgloss.NewStyle().Foreground(ErrorColor).SetString("[FAIL]")
	skipMark    = lipgloss.NewStyle().Foreground(WarningColor).SetString("[SKIP]")
	headerStyle = lipgloss.NewStyle().Foreground(Primary).Bold(true)
)

// ASCII header from /home/nomadx/bit/CURSOR.txt
const asciiHeader = `▄███████▄ ████████▄ █████████ ███▄    ██           ▄██████▄ ██     ██ ████████▄ ▄███████   ▄███████▄  ████████▄
██     ██ ██     ██ ██        ██▀██▄  ██          ██▀    ▀▀ ██     ██ ██     ██ ██         ██     ██  ██     ██
██     ██ ████████▀ ███████   ██  ██▄ ██ ████████ ██        ██     ██ ████████▀ ▀███████▄  ██     ██  ████████▀
██     ██ ██        ██        ██   ▀█▄██          ██▄    ▄▄ ██     ██ ██ ▀██▄          ██  ██     ██  ██ ▀██▄
▀███████▀ ██        █████████ ██    ▀███           ▀██████▀ ▀███████▀ ██   ▀███  ███████▀  ▀███████▀  ██   ▀███`
```

**Step 2: Commit**

```bash
git add cmd/installer/theme.go
git commit -m "feat: add installer theme with OPEN-CURSOR ASCII header"
```

---

## Task 9: Port Beams Animation from Jellywatch

**Files:**
- Create: `cmd/installer/animations.go`
- Source: `/home/nomadx/Documents/jellywatch/cmd/installer/animations.go`

**Step 1: Copy animations.go from jellywatch**

```bash
cp /home/nomadx/Documents/jellywatch/cmd/installer/animations.go /home/nomadx/opencode-cursor/cmd/installer/animations.go
```

**Step 2: Remove jellywatch-specific roasts from TypewriterTicker**

Edit `animations.go` to replace `jellyWatchRoasts` reference with installer messages:

```go
// Replace the NewTypewriterTicker function's roasts initialization:
func NewTypewriterTicker() *TypewriterTicker {
	roasts := []string{
		"Installing OpenCode-Cursor plugin...",
		"Bypassing E2BIG errors since 2026",
		"stdin/stdout > CLI args",
		"Cursor Agent integration made simple",
	}
	rand.Shuffle(len(roasts), func(i, j int) {
		roasts[i], roasts[j] = roasts[j], roasts[i]
	})
	// ... rest of function unchanged
```

**Step 3: Commit**

```bash
git add cmd/installer/animations.go
git commit -m "feat: port beams animation from jellywatch"
```

---

## Task 10: Create Types

**Files:**
- Create: `cmd/installer/types.go`

**Step 1: Create simplified types.go**

```go
// cmd/installer/types.go
package main

import (
	"context"
	"os"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
)

// Installation steps
type installStep int

const (
	stepWelcome installStep = iota
	stepInstalling
	stepComplete
)

// Task status
type taskStatus int

const (
	statusPending taskStatus = iota
	statusRunning
	statusComplete
	statusFailed
	statusSkipped
)

// Installation task
type installTask struct {
	name         string
	description  string
	execute      func(*model) error
	optional     bool
	status       taskStatus
	errorDetails *errorInfo
}

type errorInfo struct {
	message string
	command string
	logFile string
}

// Pre-install check result
type checkResult struct {
	name    string
	passed  bool
	message string
	warning bool // true = non-blocking warning, false = blocking error
}

// Main model
type model struct {
	step             installStep
	tasks            []installTask
	currentTaskIndex int
	width            int
	height           int
	spinner          spinner.Model
	errors           []string
	warnings         []string
	selectedOption   int
	debugMode        bool
	logFile          *os.File

	// Animations
	beams  *BeamsTextEffect
	ticker *TypewriterTicker

	// Pre-install checks
	checks         []checkResult
	checksComplete bool

	// Installation paths
	projectDir    string
	pluginDir     string
	configPath    string
	existingSetup bool

	// Context for cancellation
	ctx    context.Context
	cancel context.CancelFunc
}

// Messages
type taskCompleteMsg struct {
	index   int
	success bool
	err     string
}

type checksCompleteMsg struct {
	checks []checkResult
}

type tickMsg time.Time

// globalProgram for sending messages from goroutines
var globalProgram *tea.Program
```

Note: Add `tea "github.com/charmbracelet/bubbletea"` to imports.

**Step 2: Commit**

```bash
git add cmd/installer/types.go
git commit -m "feat: add installer types"
```

---

## Task 11: Create Utils

**Files:**
- Create: `cmd/installer/utils.go`

**Step 1: Create utils.go**

```go
// cmd/installer/utils.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"time"
)

// getConfigDir returns ~/.config for the actual user
func getConfigDir() (string, error) {
	if sudoUser := os.Getenv("SUDO_USER"); sudoUser != "" && sudoUser != "root" {
		u, err := user.Lookup(sudoUser)
		if err == nil {
			return filepath.Join(u.HomeDir, ".config"), nil
		}
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".config"), nil
}

// getActualUser returns the actual username (not root when using sudo)
func getActualUser() string {
	if sudoUser := os.Getenv("SUDO_USER"); sudoUser != "" && sudoUser != "root" {
		return sudoUser
	}
	if u, err := user.Current(); err == nil {
		return u.Username
	}
	return "unknown"
}

// detectExistingSetup checks if cursor-acp is already configured
func detectExistingSetup() (bool, string) {
	configDir, err := getConfigDir()
	if err != nil {
		return false, ""
	}

	configPath := filepath.Join(configDir, "opencode", "opencode.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return false, configPath
	}

	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return false, configPath
	}

	if providers, ok := config["provider"].(map[string]interface{}); ok {
		if _, exists := providers["cursor-acp"]; exists {
			return true, configPath
		}
	}

	return false, configPath
}

// commandExists checks if a command is available
func commandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// runCommand executes a command and logs output
func runCommand(name string, cmd *exec.Cmd, logFile *os.File) error {
	if logFile != nil {
		logFile.WriteString(fmt.Sprintf("[%s] Running: %s\n",
			time.Now().Format("15:04:05"), cmd.String()))
	}

	output, err := cmd.CombinedOutput()

	if logFile != nil {
		if len(output) > 0 {
			logFile.Write(output)
			logFile.WriteString("\n")
		}
		if err != nil {
			logFile.WriteString(fmt.Sprintf("[%s] Error: %v\n\n",
				time.Now().Format("15:04:05"), err))
		} else {
			logFile.WriteString(fmt.Sprintf("[%s] Success\n\n",
				time.Now().Format("15:04:05")))
		}
		logFile.Sync()
	}

	return err
}

// validateJSON checks if a file contains valid JSON
func validateJSON(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	var js interface{}
	if err := json.Unmarshal(data, &js); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	return nil
}

// cursorAgentLoggedIn checks if cursor-agent is logged in
func cursorAgentLoggedIn() bool {
	cmd := exec.Command("cursor-agent", "whoami")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return !strings.Contains(string(output), "Not logged in")
}

// getProjectDir returns the directory containing this installer
func getProjectDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "/home/nomadx/opencode-cursor"
	}
	// Follow symlink if needed
	real, err := filepath.EvalSymlinks(exe)
	if err != nil {
		return filepath.Dir(exe)
	}
	// Go up from cmd/installer to project root
	return filepath.Dir(filepath.Dir(filepath.Dir(real)))
}
```

**Step 2: Commit**

```bash
git add cmd/installer/utils.go
git commit -m "feat: add installer utilities"
```

---

## Task 12: Create Tasks

**Files:**
- Create: `cmd/installer/tasks.go`

**Step 1: Create tasks.go**

```go
// cmd/installer/tasks.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
)

func (m model) startInstallation() (tea.Model, tea.Cmd) {
	m.step = stepInstalling

	m.tasks = []installTask{
		{name: "Check prerequisites", description: "Verifying bun and cursor-agent", execute: checkPrerequisites, status: statusPending},
		{name: "Build plugin", description: "Running bun install && bun run build", execute: buildPlugin, status: statusPending},
		{name: "Create symlink", description: "Linking to OpenCode plugin directory", execute: createSymlink, status: statusPending},
		{name: "Update config", description: "Adding cursor-acp provider to opencode.json", execute: updateConfig, status: statusPending},
		{name: "Validate config", description: "Checking JSON syntax", execute: validateConfig, status: statusPending},
		{name: "Verify plugin", description: "Testing plugin loads correctly", execute: verifyPlugin, optional: true, status: statusPending},
	}

	m.currentTaskIndex = 0
	m.tasks[0].status = statusRunning
	return m, tea.Batch(m.spinner.Tick, executeTaskCmd(0, &m))
}

func executeTaskCmd(index int, m *model) tea.Cmd {
	return func() tea.Msg {
		if index >= len(m.tasks) {
			return taskCompleteMsg{index: index, success: true}
		}

		task := &m.tasks[index]
		err := task.execute(m)

		if err != nil {
			return taskCompleteMsg{
				index:   index,
				success: false,
				err:     err.Error(),
			}
		}

		return taskCompleteMsg{index: index, success: true}
	}
}

func checkPrerequisites(m *model) error {
	if !commandExists("bun") {
		return fmt.Errorf("bun not found - install with: curl -fsSL https://bun.sh/install | bash")
	}
	if !commandExists("cursor-agent") {
		return fmt.Errorf("cursor-agent not found - install with: curl -fsS https://cursor.com/install | bash")
	}
	return nil
}

func buildPlugin(m *model) error {
	// Run bun install
	installCmd := exec.Command("bun", "install")
	installCmd.Dir = m.projectDir
	if err := runCommand("bun install", installCmd, m.logFile); err != nil {
		return fmt.Errorf("bun install failed")
	}

	// Run bun run build
	buildCmd := exec.Command("bun", "run", "build")
	buildCmd.Dir = m.projectDir
	if err := runCommand("bun run build", buildCmd, m.logFile); err != nil {
		return fmt.Errorf("bun run build failed")
	}

	// Verify dist/index.js exists
	distPath := filepath.Join(m.projectDir, "dist", "index.js")
	info, err := os.Stat(distPath)
	if err != nil || info.Size() == 0 {
		return fmt.Errorf("dist/index.js not found or empty after build")
	}

	return nil
}

func createSymlink(m *model) error {
	// Ensure plugin directory exists
	if err := os.MkdirAll(m.pluginDir, 0755); err != nil {
		return fmt.Errorf("failed to create plugin directory: %w", err)
	}

	symlinkPath := filepath.Join(m.pluginDir, "cursor-acp.js")
	targetPath := filepath.Join(m.projectDir, "dist", "index.js")

	// Remove existing symlink if present
	os.Remove(symlinkPath)

	// Create symlink
	if err := os.Symlink(targetPath, symlinkPath); err != nil {
		return fmt.Errorf("failed to create symlink: %w", err)
	}

	// Verify symlink resolves
	if _, err := os.Stat(symlinkPath); err != nil {
		return fmt.Errorf("symlink verification failed: %w", err)
	}

	return nil
}

func updateConfig(m *model) error {
	// Read existing config or create new
	var config map[string]interface{}

	data, err := os.ReadFile(m.configPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("failed to read config: %w", err)
		}
		// Create new config
		config = make(map[string]interface{})
	} else {
		if err := json.Unmarshal(data, &config); err != nil {
			return fmt.Errorf("failed to parse config: %w", err)
		}
	}

	// Ensure provider section exists
	providers, ok := config["provider"].(map[string]interface{})
	if !ok {
		providers = make(map[string]interface{})
		config["provider"] = providers
	}

	// Add cursor-acp provider
	providers["cursor-acp"] = map[string]interface{}{
		"npm":  "@ai-sdk/openai-compatible",
		"name": "Cursor Agent (ACP stdin)",
		"options": map[string]interface{}{
			"baseURL": "http://127.0.0.1:32123/v1",
		},
	}

	// Write config back
	output, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}

	// Ensure config directory exists
	if err := os.MkdirAll(filepath.Dir(m.configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	if err := os.WriteFile(m.configPath, output, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

func validateConfig(m *model) error {
	if err := validateJSON(m.configPath); err != nil {
		return fmt.Errorf("config validation failed: %w", err)
	}

	// Verify cursor-acp provider exists in config
	data, _ := os.ReadFile(m.configPath)
	var config map[string]interface{}
	json.Unmarshal(data, &config)

	providers, ok := config["provider"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("provider section missing from config")
	}

	if _, exists := providers["cursor-acp"]; !exists {
		return fmt.Errorf("cursor-acp provider not found in config")
	}

	return nil
}

func verifyPlugin(m *model) error {
	// Try to load plugin with node to catch syntax/import errors
	pluginPath := filepath.Join(m.projectDir, "dist", "index.js")
	cmd := exec.Command("node", "-e", fmt.Sprintf(`require("%s")`, pluginPath))
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("plugin failed to load: %w", err)
	}

	// Check cursor-agent responds
	cmd = exec.Command("cursor-agent", "--version")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("cursor-agent not responding")
	}

	return nil
}

func (m model) handleTaskComplete(msg taskCompleteMsg) (tea.Model, tea.Cmd) {
	if msg.index >= len(m.tasks) {
		m.step = stepComplete
		return m, nil
	}

	task := &m.tasks[msg.index]

	if msg.success {
		task.status = statusComplete
	} else {
		task.status = statusFailed
		task.errorDetails = &errorInfo{
			message: msg.err,
			logFile: m.logFile.Name(),
		}
		// If not optional, stop installation
		if !task.optional {
			m.errors = append(m.errors, msg.err)
			m.step = stepComplete
			return m, nil
		}
	}

	// Move to next task
	m.currentTaskIndex++
	if m.currentTaskIndex >= len(m.tasks) {
		m.step = stepComplete
		return m, nil
	}

	m.tasks[m.currentTaskIndex].status = statusRunning
	return m, executeTaskCmd(m.currentTaskIndex, &m)
}
```

**Step 2: Commit**

```bash
git add cmd/installer/tasks.go
git commit -m "feat: add installation tasks"
```

---

## Task 13: Create Main

**Files:**
- Create: `cmd/installer/main.go`

**Step 1: Create main.go**

```go
// cmd/installer/main.go
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

func newModel(debugMode bool, logFile *os.File) model {
	s := spinner.New()
	s.Style = lipgloss.NewStyle().Foreground(Secondary)
	s.Spinner = spinner.Dot

	ctx, cancel := context.WithCancel(context.Background())

	// Detect paths
	configDir, _ := getConfigDir()
	projectDir := getProjectDir()
	existingSetup, configPath := detectExistingSetup()

	m := model{
		step:          stepWelcome,
		tasks:         []installTask{},
		spinner:       s,
		errors:        []string{},
		warnings:      []string{},
		debugMode:     debugMode,
		logFile:       logFile,
		ctx:           ctx,
		cancel:        cancel,
		projectDir:    projectDir,
		pluginDir:     filepath.Join(configDir, "opencode", "plugin"),
		configPath:    configPath,
		existingSetup: existingSetup,

		// Animations (initialized on first resize)
		beams:  nil,
		ticker: NewTypewriterTicker(),
	}

	// Run pre-install checks
	m.checks = runPreInstallChecks()

	return m
}

func runPreInstallChecks() []checkResult {
	var checks []checkResult

	// Check bun
	if commandExists("bun") {
		checks = append(checks, checkResult{name: "bun", passed: true, message: "installed"})
	} else {
		checks = append(checks, checkResult{name: "bun", passed: false, message: "not found - install with: curl -fsSL https://bun.sh/install | bash"})
	}

	// Check cursor-agent
	if commandExists("cursor-agent") {
		checks = append(checks, checkResult{name: "cursor-agent", passed: true, message: "installed"})
		// Check if logged in
		if cursorAgentLoggedIn() {
			checks = append(checks, checkResult{name: "cursor-agent login", passed: true, message: "logged in"})
		} else {
			checks = append(checks, checkResult{name: "cursor-agent login", passed: false, message: "not logged in - run: cursor-agent login", warning: true})
		}
	} else {
		checks = append(checks, checkResult{name: "cursor-agent", passed: false, message: "not found - install with: curl -fsS https://cursor.com/install | bash"})
	}

	// Check OpenCode config directory
	configDir, err := getConfigDir()
	if err == nil {
		opencodeDir := filepath.Join(configDir, "opencode")
		if _, err := os.Stat(opencodeDir); err == nil {
			checks = append(checks, checkResult{name: "OpenCode config", passed: true, message: opencodeDir})
		} else {
			checks = append(checks, checkResult{name: "OpenCode config", passed: true, message: "will create: " + opencodeDir, warning: true})
		}
	}

	return checks
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tickCmd(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*50, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func main() {
	debugMode := false
	for _, arg := range os.Args[1:] {
		if arg == "--debug" || arg == "-d" {
			debugMode = true
			break
		}
	}

	logFile, err := os.CreateTemp("", "opencode-cursor-installer-*.log")
	if err != nil {
		logFile = nil
	}
	if logFile != nil {
		defer logFile.Close()
		logFile.WriteString(fmt.Sprintf("=== OpenCode-Cursor Installer Log ===\n"))
		logFile.WriteString(fmt.Sprintf("Started: %s\n", time.Now().Format("2006-01-02 15:04:05")))
		logFile.WriteString(fmt.Sprintf("Debug Mode: %v\n\n", debugMode))
	}

	m := newModel(debugMode, logFile)
	p := tea.NewProgram(m, tea.WithAltScreen())
	globalProgram = p

	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}
```

**Step 2: Commit**

```bash
git add cmd/installer/main.go
git commit -m "feat: add installer main entry point"
```

---

## Task 14: Create Update Handler

**Files:**
- Create: `cmd/installer/update.go`

**Step 1: Create update.go**

```go
// cmd/installer/update.go
package main

import (
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		headerHeight := 7
		if m.beams == nil {
			m.beams = NewBeamsTextEffect(msg.Width, headerHeight, asciiHeader)
		} else {
			m.beams.Resize(msg.Width, headerHeight)
		}
		return m, nil

	case tickMsg:
		if m.beams != nil {
			m.beams.Update()
		}
		if m.ticker != nil {
			m.ticker.Update()
		}
		return m, tickCmd()

	case tea.KeyMsg:
		return m.handleKeyPress(msg)

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case taskCompleteMsg:
		return m.handleTaskComplete(msg)
	}

	return m, nil
}

func (m model) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	switch key {
	case "ctrl+c":
		if m.step != stepInstalling {
			if m.cancel != nil {
				m.cancel()
			}
			return m, tea.Quit
		}
		return m, nil

	case "q":
		if m.step == stepComplete || m.step == stepWelcome {
			return m, tea.Quit
		}
	}

	switch m.step {
	case stepWelcome:
		return m.handleWelcomeKeys(key)
	case stepComplete:
		return m.handleCompleteKeys(key)
	}

	return m, nil
}

func (m model) handleWelcomeKeys(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "enter":
		// Check for blocking errors
		for _, check := range m.checks {
			if !check.passed && !check.warning {
				return m, nil // Don't proceed with blocking errors
			}
		}
		return m.startInstallation()
	}
	return m, nil
}

func (m model) handleCompleteKeys(key string) (tea.Model, tea.Cmd) {
	if key == "enter" || key == "q" {
		return m, tea.Quit
	}
	return m, nil
}
```

**Step 2: Commit**

```bash
git add cmd/installer/update.go
git commit -m "feat: add installer update handler"
```

---

## Task 15: Create View

**Files:**
- Create: `cmd/installer/view.go`

**Step 1: Create view.go**

```go
// cmd/installer/view.go
package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func (m model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	if m.width < 80 || m.height < 24 {
		return lipgloss.NewStyle().
			Foreground(ErrorColor).
			Background(BgBase).
			Bold(true).
			Width(m.width).
			Height(m.height).
			Render(fmt.Sprintf(
				"Terminal too small!\n\nMinimum: 80x24\nCurrent: %dx%d\n\nPlease resize.",
				m.width, m.height,
			))
	}

	var content strings.Builder

	// Render animated ASCII header
	if m.beams != nil {
		beamsOutput := m.beams.Render()
		content.WriteString(beamsOutput)
		content.WriteString("\n")
	} else {
		headerLines := strings.Split(asciiHeader, "\n")
		for _, line := range headerLines {
			centered := lipgloss.NewStyle().
				Width(m.width).
				Align(lipgloss.Center).
				Foreground(Primary).
				Background(BgBase).
				Bold(true).
				Render(line)
			content.WriteString(centered)
			content.WriteString("\n")
		}
	}
	content.WriteString("\n")

	// Render ticker
	if m.ticker != nil {
		tickerText := m.ticker.Render(m.width - 4)
		tickerStyled := lipgloss.NewStyle().
			Foreground(FgMuted).
			Background(BgBase).
			Italic(true).
			Width(m.width).
			Align(lipgloss.Center).
			Render(tickerText)
		content.WriteString(tickerStyled)
		content.WriteString("\n\n")
	}

	// Main content based on step
	var mainContent string
	switch m.step {
	case stepWelcome:
		mainContent = m.renderWelcome()
	case stepInstalling:
		mainContent = m.renderInstalling()
	case stepComplete:
		mainContent = m.renderComplete()
	}

	mainStyle := lipgloss.NewStyle().
		Padding(1, 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(Secondary).
		Foreground(FgPrimary).
		Background(BgBase).
		Width(m.width - 4)
	content.WriteString(mainStyle.Render(mainContent))
	content.WriteString("\n")

	// Help text
	helpText := m.getHelpText()
	if helpText != "" {
		helpStyle := lipgloss.NewStyle().
			Foreground(FgMuted).
			Background(BgBase).
			Italic(true).
			Width(m.width).
			Align(lipgloss.Center)
		content.WriteString("\n" + helpStyle.Render(helpText))
	}

	// Full screen background
	bgStyle := lipgloss.NewStyle().
		Background(BgBase).
		Foreground(FgPrimary).
		Width(m.width).
		Height(m.height).
		Align(lipgloss.Center, lipgloss.Top)

	return bgStyle.Render(content.String())
}

func (m model) getHelpText() string {
	switch m.step {
	case stepWelcome:
		return "Enter: Install  •  q: Quit"
	case stepInstalling:
		return "Please wait..."
	case stepComplete:
		return "Enter: Exit"
	}
	return ""
}

func (m model) renderWelcome() string {
	var b strings.Builder

	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(Primary).Render("OpenCode-Cursor Plugin Installer"))
	b.WriteString("\n\n")

	b.WriteString("Pre-install checks:\n\n")

	for _, check := range m.checks {
		var status string
		if check.passed {
			status = checkMark.String()
		} else if check.warning {
			status = skipMark.String()
		} else {
			status = failMark.String()
		}
		b.WriteString(fmt.Sprintf("  %s %s: %s\n", status, check.name, check.message))
	}

	b.WriteString("\n")

	if m.existingSetup {
		b.WriteString(lipgloss.NewStyle().Foreground(WarningColor).Render("⚠ cursor-acp already configured - will reinstall"))
		b.WriteString("\n\n")
	}

	// Check if we can proceed
	canProceed := true
	for _, check := range m.checks {
		if !check.passed && !check.warning {
			canProceed = false
			break
		}
	}

	if canProceed {
		b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(Primary).Render("Press Enter to install"))
	} else {
		b.WriteString(lipgloss.NewStyle().Foreground(ErrorColor).Render("Fix errors above before installing"))
	}

	return b.String()
}

func (m model) renderInstalling() string {
	var b strings.Builder

	for _, task := range m.tasks {
		var line string
		switch task.status {
		case statusPending:
			line = lipgloss.NewStyle().Foreground(FgMuted).Render("  " + task.name)
		case statusRunning:
			line = m.spinner.View() + " " + lipgloss.NewStyle().Foreground(Secondary).Render(task.description)
		case statusComplete:
			line = checkMark.String() + " " + task.name
		case statusFailed:
			line = failMark.String() + " " + task.name
		case statusSkipped:
			line = skipMark.String() + " " + task.name
		}
		b.WriteString(line + "\n")

		if task.status == statusFailed && task.errorDetails != nil {
			err := task.errorDetails
			b.WriteString(lipgloss.NewStyle().Foreground(ErrorColor).Render(
				fmt.Sprintf("  └─ Error: %s\n", err.message)))
			if err.logFile != "" {
				b.WriteString(lipgloss.NewStyle().Foreground(FgMuted).Render(
					fmt.Sprintf("  └─ See logs: %s\n", err.logFile)))
			}
		}
	}

	return b.String()
}

func (m model) renderComplete() string {
	hasCriticalFailure := false
	for _, task := range m.tasks {
		if task.status == statusFailed && !task.optional {
			hasCriticalFailure = true
			break
		}
	}

	if hasCriticalFailure {
		return lipgloss.NewStyle().Foreground(ErrorColor).Render(
			"Installation failed.\nCheck errors above.\n\nPress Enter to exit")
	}

	var b strings.Builder
	b.WriteString(lipgloss.NewStyle().Foreground(SuccessColor).Bold(true).Render("✓ Installation Complete"))
	b.WriteString("\n\n")

	b.WriteString("The cursor-acp provider is now available in OpenCode.\n\n")

	b.WriteString(lipgloss.NewStyle().Bold(true).Foreground(Primary).Render("Quick Start"))
	b.WriteString("\n")

	cmdStyle := lipgloss.NewStyle().Foreground(Secondary)
	descStyle := lipgloss.NewStyle().Foreground(FgMuted)

	b.WriteString(fmt.Sprintf("  %s  %s\n", cmdStyle.Render("opencode"), descStyle.Render("Start OpenCode")))
	b.WriteString(fmt.Sprintf("  %s  %s\n\n", cmdStyle.Render("cursor-acp/auto"), descStyle.Render("Use as model name")))

	if !cursorAgentLoggedIn() {
		b.WriteString(lipgloss.NewStyle().Foreground(WarningColor).Render("⚠ Remember to run: cursor-agent login"))
		b.WriteString("\n\n")
	}

	pathStyle := lipgloss.NewStyle().Foreground(FgMuted).Italic(true)
	b.WriteString(fmt.Sprintf("Plugin:  %s\n", pathStyle.Render(m.pluginDir+"/cursor-acp.js")))
	b.WriteString(fmt.Sprintf("Config:  %s\n", pathStyle.Render(m.configPath)))

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Foreground(FgMuted).Render("Press Enter to exit"))

	return b.String()
}
```

**Step 2: Commit**

```bash
git add cmd/installer/view.go
git commit -m "feat: add installer view rendering"
```

---

## Task 16: Create install.sh Entry Point

**Files:**
- Create: `install.sh`

**Step 1: Create install.sh**

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_BIN="/tmp/opencode-cursor-installer-$$"

echo "OpenCode-Cursor Installer"
echo "========================="
echo ""

# Check for Go
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed"
    echo "Please install Go 1.21 or later from https://golang.org/dl/"
    exit 1
fi

# Build installer
echo "Building installer..."
cd "$SCRIPT_DIR"
go build -o "$INSTALLER_BIN" ./cmd/installer

# Run installer
echo ""
"$INSTALLER_BIN" "$@"
EXIT_CODE=$?

# Cleanup
rm -f "$INSTALLER_BIN"

exit $EXIT_CODE
```

**Step 2: Make executable**

```bash
chmod +x install.sh
```

**Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: add install.sh entry point"
```

---

## Task 17: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update README with new installation method**

```markdown
# opencode-cursor

A lightweight OpenCode plugin for Cursor Agent integration via stdin (fixes E2BIG errors).

## Background

[PR #5095](https://github.com/sst/opencode/pull/5095) by [@rinardmclern](https://github.com/rinardmclern) proposed native ACP support for OpenCode. The OpenCode maintainers decided not to merge it, so this plugin provides an alternative solution as a standalone tool.

## Problem Solved

`opencode-cursor-auth` passes prompts as CLI arguments → causes `E2BIG: argument list too long` errors.

This plugin uses stdin/stdout to bypass argument length limits.

## Installation

### Quick Install (Recommended)

```bash
git clone https://github.com/nomadcxx/opencode-cursor.git
cd opencode-cursor
./install.sh
```

The installer will:
- Check prerequisites (bun, cursor-agent)
- Build the TypeScript plugin
- Create symlink to OpenCode plugin directory
- Update opencode.json with cursor-acp provider
- Validate the configuration

### Manual Installation

```bash
# Install dependencies and build
bun install
bun run build

# Create plugin directory
mkdir -p ~/.config/opencode/plugin

# Symlink plugin
ln -s $(pwd)/dist/index.js ~/.config/opencode/plugin/cursor-acp.js

# Add to ~/.config/opencode/opencode.json:
# {
#   "provider": {
#     "cursor-acp": {
#       "npm": "@ai-sdk/openai-compatible",
#       "name": "Cursor Agent (ACP stdin)",
#       "options": {
#         "baseURL": "http://127.0.0.1:32123/v1"
#       }
#     }
#   }
# }
```

## Usage

OpenCode will automatically use this provider when configured. Select `cursor-acp/auto` as your model.

## Features

- ✅ Passes prompts via stdin (fixes E2BIG)
- ✅ Full streaming support with proper buffering
- ✅ Tool calling support
- ✅ Minimal complexity (~200 lines)
- ✅ TUI installer with animated ASCII art
- ✅ Pre/post install validation

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime
- [cursor-agent](https://cursor.com/) - Cursor CLI tool
- [Go 1.21+](https://golang.org/) - For building installer

## Development

```bash
# Install dependencies
bun install

# Build plugin
bun run build

# Watch mode
bun run dev

# Run installer in debug mode
./install.sh --debug
```

## License

ISC
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with installer instructions"
```

---

## Task 18: Build and Test

**Step 1: Build TypeScript plugin**

```bash
cd /home/nomadx/opencode-cursor
bun install
bun run build
```

**Step 2: Build Go installer**

```bash
go build ./cmd/installer
```

**Step 3: Run installer in debug mode**

```bash
./install.sh --debug
```

**Step 4: Verify installation**

```bash
ls -la ~/.config/opencode/plugin/cursor-acp.js
cat ~/.config/opencode/opencode.json | jq '.provider["cursor-acp"]'
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete opencode-cursor plugin with TUI installer"
```

---

## Remember

- Exact file paths: `/home/nomadx/opencode-cursor`
- Port animations.go from `/home/nomadx/Documents/jellywatch/cmd/installer/`
- Keep theme identical to jellywatch (monochrome)
- DRY, YAGNI, TDD, frequent commits

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-01-23-cursor-acp-plugin-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session in worktree with executing-plans, batch execution with checkpoints

Which approach?

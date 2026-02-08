import type { ToolRegistry } from "./core/registry.js";

/**
 * Register default OpenCode tools in the registry
 */
export function registerDefaultTools(registry: ToolRegistry): void {
  // 1. Bash tool - Execute shell commands
  registry.register({
    id: "bash",
    name: "bash",
    description: "Execute a shell command in a safe environment",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 30000)"
        },
        cwd: {
          type: "string",
          description: "Working directory for the command"
        }
      },
      required: ["command"]
    },
    source: "local" as const
  }, async (args) => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const command = args.command as string;
      const timeout = args.timeout as number | undefined;
      const cwd = args.cwd as string | undefined;
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout || 30000,
        cwd: cwd
      });
      return stdout || stderr || "Command executed successfully";
    } catch (error: any) {
      throw error;
    }
  });

  // 2. Read tool - Read file contents
  registry.register({
    id: "read",
    name: "read",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the file to read"
        },
        offset: {
          type: "number",
          description: "Line number to start reading from"
        },
        limit: {
          type: "number",
          description: "Maximum number of lines to read"
        }
      },
      required: ["path"]
    },
    source: "local" as const
  }, async (args) => {
    const fs = await import("fs");
    try {
      const path = args.path as string;
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      let content = fs.readFileSync(path, "utf-8");

      if (offset !== undefined || limit !== undefined) {
        const lines = content.split("\n");
        const start = offset || 0;
        const end = limit ? start + limit : lines.length;
        content = lines.slice(start, end).join("\n");
      }

      return content;
    } catch (error: any) {
      throw error;
    }
  });

  // 3. Write tool - Write file contents
  registry.register({
    id: "write",
    name: "write",
    description: "Write content to a file (creates or overwrites)",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the file to write"
        },
        content: {
          type: "string",
          description: "Content to write to the file"
        }
      },
      required: ["path", "content"]
    },
    source: "local" as const
  }, async (args) => {
    const fs = await import("fs");
    const path = await import("path");
    try {
      const filePath = args.path as string;
      const content = args.content as string;
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, "utf-8");
      return `File written successfully: ${filePath}`;
    } catch (error: any) {
      throw error;
    }
  });

  // 4. Edit tool - Edit file contents
  registry.register({
    id: "edit",
    name: "edit",
    description: "Edit a file by replacing old text with new text",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the file to edit"
        },
        old_string: {
          type: "string",
          description: "The text to replace"
        },
        new_string: {
          type: "string",
          description: "The replacement text"
        }
      },
      required: ["path", "old_string", "new_string"]
    },
    source: "local" as const
  }, async (args) => {
    const fs = await import("fs");
    try {
      const path = args.path as string;
      const oldString = args.old_string as string;
      const newString = args.new_string as string;
      let content = fs.readFileSync(path, "utf-8");

      if (!content.includes(oldString)) {
        return `Error: Could not find the text to replace in ${path}`;
      }

      content = content.replaceAll(oldString, newString);
      fs.writeFileSync(path, content, "utf-8");

      return `File edited successfully: ${path}`;
    } catch (error: any) {
      throw error;
    }
  });

  // 5. Grep tool - Search file contents
  registry.register({
    id: "grep",
    name: "grep",
    description: "Search for a pattern in files",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The search pattern (regex supported)"
        },
        path: {
          type: "string",
          description: "Directory or file to search in"
        },
        include: {
          type: "string",
          description: "File pattern to include (e.g., '*.ts')"
        }
      },
      required: ["pattern", "path"]
    },
    source: "local" as const
  }, async (args) => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const pattern = args.pattern as string;
      const path = args.path as string;
      const include = args.include as string | undefined;
      const includeFlag = include ? `--include="${include}"` : "";
      const { stdout } = await execAsync(
        `grep -r ${includeFlag} -n "${pattern}" "${path}" 2>/dev/null || true`,
        { timeout: 30000 }
      );

      return stdout || "No matches found";
    } catch (error: any) {
      throw error;
    }
  });

  // 6. LS tool - List directory contents
  registry.register({
    id: "ls",
    name: "ls",
    description: "List directory contents",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the directory"
        }
      },
      required: ["path"]
    },
    source: "local" as const
  }, async (args) => {
    const fs = await import("fs");
    const path = await import("path");
    try {
      const dirPath = args.path as string;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      const result = entries.map(entry => {
        const type = entry.isDirectory() ? "d" :
                     entry.isSymbolicLink() ? "l" :
                     entry.isFile() ? "f" : "?";
        return `[${type}] ${entry.name}`;
      });

      return result.join("\n") || "Empty directory";
    } catch (error: any) {
      throw error;
    }
  });

  // 7. Glob tool - Find files matching pattern
  registry.register({
    id: "glob",
    name: "glob",
    description: "Find files matching a glob pattern",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern (e.g., '**/*.ts')"
        },
        path: {
          type: "string",
          description: "Directory to search in (default: current directory)"
        }
      },
      required: ["pattern"]
    },
    source: "local" as const
  }, async (args) => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const pattern = args.pattern as string;
      const path = args.path as string | undefined;
      const cwd = path || ".";
      const { stdout } = await execAsync(
        `find "${cwd}" -type f -name "${pattern}" 2>/dev/null | head -50`,
        { timeout: 30000 }
      );

      return stdout || "No files found";
    } catch (error: any) {
      throw error;
    }
  });
}

/**
 * Get the names of all default tools
 */
export function getDefaultToolNames(): string[] {
  return ["bash", "read", "write", "edit", "grep", "ls", "glob"];
}
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
    const path = await import("path");
    try {
      const filePath = args.path as string;
      const oldString = args.old_string as string;
      const newString = args.new_string as string;
      let content = "";
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch (error: any) {
        if (error?.code === "ENOENT") {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, newString, "utf-8");
          return `File did not exist. Created and wrote content: ${filePath}`;
        }
        throw error;
      }

      if (!oldString) {
        fs.writeFileSync(filePath, newString, "utf-8");
        return `File edited successfully: ${filePath}`;
      }

      if (!content.includes(oldString)) {
        return `Error: Could not find the text to replace in ${filePath}`;
      }

      content = content.replaceAll(oldString, newString);
      fs.writeFileSync(filePath, content, "utf-8");

      return `File edited successfully: ${filePath}`;
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
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    const pattern = args.pattern as string;
    const path = args.path as string;
    const include = args.include as string | undefined;

    const grepArgs = ["-r", "-n"];
    if (include) {
      grepArgs.push(`--include=${include}`);
    }
    grepArgs.push(pattern, path);

    try {
      const { stdout } = await execFileAsync("grep", grepArgs, { timeout: 30000 });
      return stdout || "No matches found";
    } catch (error: any) {
      // grep exits with code 1 when no matches found — not an error
      if (error.code === 1) {
        return "No matches found";
      }
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
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    const pattern = args.pattern as string;
    const path = args.path as string | undefined;
    const cwd = path || ".";

    try {
      const { stdout } = await execFileAsync(
        "find", [cwd, "-type", "f", "-name", pattern],
        { timeout: 30000 }
      );
      // Limit output to 50 lines (replaces piped `| head -50`)
      const lines = (stdout || "").split("\n").filter(Boolean);
      return lines.slice(0, 50).join("\n") || "No files found";
    } catch (error: any) {
      throw error;
    }
  });

  // 8. Mkdir tool - Create directories
  registry.register({
    id: "mkdir",
    name: "mkdir",
    description: "Create a directory, including parent directories if needed",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to create"
        }
      },
      required: ["path"]
    },
    source: "local" as const
  }, async (args) => {
    const { mkdir } = await import("fs/promises");
    const { resolve } = await import("path");
    const target = resolve(String(args.path));
    await mkdir(target, { recursive: true });
    return `Created directory: ${target}`;
  });

  // 9. Rm tool - Delete files/directories
  registry.register({
    id: "rm",
    name: "rm",
    description: "Delete a file or directory. Use force: true for non-empty directories.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to delete"
        },
        force: {
          type: "boolean",
          description: "If true, recursively delete non-empty directories"
        }
      },
      required: ["path"]
    },
    source: "local" as const
  }, async (args) => {
    const { rm, stat } = await import("fs/promises");
    const { resolve } = await import("path");
    const target = resolve(String(args.path));
    const info = await stat(target);
    if (info.isDirectory() && !args.force) {
      throw new Error("Directory not empty. Use force: true to delete recursively.");
    }
    await rm(target, { recursive: !!args.force });
    return `Deleted: ${target}`;
  });

  // 10. Stat tool - Get file/directory metadata
  registry.register({
    id: "stat",
    name: "stat",
    description: "Get file or directory information: size, type, permissions, timestamps",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to inspect"
        }
      },
      required: ["path"]
    },
    source: "local" as const
  }, async (args) => {
    const { stat } = await import("fs/promises");
    const { resolve } = await import("path");
    const target = resolve(String(args.path));
    const info = await stat(target);
    return JSON.stringify({
      path: target,
      type: info.isDirectory() ? "directory" : info.isFile() ? "file" : "other",
      size: info.size,
      mode: info.mode.toString(8),
      modified: info.mtime.toISOString(),
      created: info.birthtime.toISOString(),
    }, null, 2);
  });
}

/**
 * Get the names of all default tools
 */
export function getDefaultToolNames(): string[] {
  return ["bash", "read", "write", "edit", "grep", "ls", "glob", "mkdir", "rm", "stat"];
}

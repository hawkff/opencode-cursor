import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const TEST_PLUGIN_DIR = join(homedir(), ".config", "opencode", "plugin");

describe("Plugin Directory Initialization", () => {
  beforeEach(() => {
    if (existsSync(TEST_PLUGIN_DIR)) {
      rmSync(TEST_PLUGIN_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_PLUGIN_DIR)) {
      rmSync(TEST_PLUGIN_DIR, { recursive: true, force: true });
    }
  });

  it("should create plugin directory when it does not exist", async () => {
    expect(existsSync(TEST_PLUGIN_DIR)).toBe(false);
    
    const { ensurePluginDirectory } = await import("../../src/plugin");
    await ensurePluginDirectory();
    
    expect(existsSync(TEST_PLUGIN_DIR)).toBe(true);
  });

  it("should not fail when plugin directory already exists", async () => {
    mkdirSync(TEST_PLUGIN_DIR, { recursive: true });
    expect(existsSync(TEST_PLUGIN_DIR)).toBe(true);
    
    const { ensurePluginDirectory } = await import("../../src/plugin");
    await expect(ensurePluginDirectory()).resolves.toBeUndefined();
  });

  it("should create parent directories recursively", async () => {
    const parentDir = join(homedir(), ".config", "opencode");
    if (existsSync(parentDir)) {
      rmSync(parentDir, { recursive: true, force: true });
    }
    
    const { ensurePluginDirectory } = await import("../../src/plugin");
    await ensurePluginDirectory();
    
    expect(existsSync(TEST_PLUGIN_DIR)).toBe(true);
  });
});

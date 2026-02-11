/// <reference types="bun-types/test-globals" />

import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  isCursorPluginEnabledInConfig,
  resolveOpenCodeConfigPath,
  shouldEnableCursorPlugin,
} from "../../src/plugin-toggle";

describe("plugin toggle", () => {
  it("enables plugin when plugin array includes cursor-acp", () => {
    expect(isCursorPluginEnabledInConfig({ plugin: ["cursor-acp"] })).toBe(true);
  });

  it("disables plugin when plugin array excludes cursor-acp", () => {
    expect(isCursorPluginEnabledInConfig({ plugin: ["other-plugin"] })).toBe(false);
  });

  it("keeps legacy behavior when plugin array is missing", () => {
    expect(isCursorPluginEnabledInConfig({ provider: { "cursor-acp": {} } })).toBe(true);
    expect(isCursorPluginEnabledInConfig({ provider: {} })).toBe(true);
  });

  it("resolves config from OPENCODE_CONFIG first", () => {
    const path = resolveOpenCodeConfigPath({
      OPENCODE_CONFIG: "/tmp/custom-opencode.json",
      XDG_CONFIG_HOME: "/tmp/xdg",
    });
    expect(path).toBe("/tmp/custom-opencode.json");
  });

  it("disables when config file exists and plugin array excludes cursor-acp", () => {
    const dir = mkdtempSync(join(tmpdir(), "cursor-toggle-"));
    const configPath = join(dir, "opencode.json");

    try {
      writeFileSync(configPath, JSON.stringify({ plugin: ["other-plugin"] }));
      const state = shouldEnableCursorPlugin({ OPENCODE_CONFIG: configPath });
      expect(state.enabled).toBe(false);
      expect(state.reason).toBe("disabled_in_plugin_array");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stays enabled when config is invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "cursor-toggle-"));
    const configPath = join(dir, "opencode.json");

    try {
      writeFileSync(configPath, "{not-json");
      const state = shouldEnableCursorPlugin({ OPENCODE_CONFIG: configPath });
      expect(state.enabled).toBe(true);
      expect(state.reason).toBe("config_unreadable_or_invalid");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

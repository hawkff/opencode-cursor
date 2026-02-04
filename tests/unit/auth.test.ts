import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { pollForAuthFile, verifyCursorAuth, getAuthFilePath } from "../../src/auth";

const TEST_TIMEOUT = 10000;
const TEST_AUTH_DIR = join(homedir(), ".config", "cursor");
const TEST_AUTH_FILE = join(TEST_AUTH_DIR, "auth.json");

describe("Auth Module", () => {
  beforeEach(() => {
    if (existsSync(TEST_AUTH_FILE)) {
      unlinkSync(TEST_AUTH_FILE);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_AUTH_FILE)) {
      unlinkSync(TEST_AUTH_FILE);
    }
  });

  describe("getAuthFilePath", () => {
    it("should return correct auth file path", () => {
      const path = getAuthFilePath();
      expect(path).toBe(TEST_AUTH_FILE);
      expect(path).toContain("cursor");
      expect(path).toContain("auth.json");
    });
  });

  describe("verifyCursorAuth", () => {
    it("should return false when auth file does not exist", () => {
      const result = verifyCursorAuth();
      expect(result).toBe(false);
    });

    it("should return true when auth file exists", () => {
      if (!existsSync(TEST_AUTH_DIR)) {
        mkdirSync(TEST_AUTH_DIR, { recursive: true });
      }
      writeFileSync(TEST_AUTH_FILE, JSON.stringify({ token: "test" }));
      
      const result = verifyCursorAuth();
      expect(result).toBe(true);
    });
  });

  describe("pollForAuthFile", () => {
    it("should return true when auth file already exists", async () => {
      if (!existsSync(TEST_AUTH_DIR)) {
        mkdirSync(TEST_AUTH_DIR, { recursive: true });
      }
      writeFileSync(TEST_AUTH_FILE, JSON.stringify({ token: "test" }));

      const result = await pollForAuthFile(1000, 100);
      expect(result).toBe(true);
    }, TEST_TIMEOUT);

    it("should return false when auth file never appears", async () => {
      const result = await pollForAuthFile(500, 100);
      expect(result).toBe(false);
    }, TEST_TIMEOUT);

    it("should detect auth file created during polling", async () => {
      const pollPromise = pollForAuthFile(2000, 100);
      
      setTimeout(() => {
        if (!existsSync(TEST_AUTH_DIR)) {
          mkdirSync(TEST_AUTH_DIR, { recursive: true });
        }
        writeFileSync(TEST_AUTH_FILE, JSON.stringify({ token: "test" }));
      }, 300);

      const result = await pollPromise;
      expect(result).toBe(true);
    }, TEST_TIMEOUT);

    it("should respect custom timeout", async () => {
      const startTime = Date.now();
      const result = await pollForAuthFile(300, 50);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(500);
    }, TEST_TIMEOUT);

    it("should respect custom interval", async () => {
      let checkCount = 0;
      const originalExistsSync = existsSync;
      
      mock.module("fs", () => ({
        ...require("fs"),
        existsSync: (path: string) => {
          if (path === TEST_AUTH_FILE) {
            checkCount++;
          }
          return originalExistsSync(path);
        }
      }));

      await pollForAuthFile(500, 100);
      
      expect(checkCount).toBeGreaterThanOrEqual(4);
      expect(checkCount).toBeLessThanOrEqual(7);
    }, TEST_TIMEOUT);
  });
});

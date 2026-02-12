// tests/unit/cli/opencode-cursor.test.ts
import { describe, expect, it } from "bun:test";
import { getBrandingHeader } from "../../../src/cli/opencode-cursor.js";

describe("cli/opencode-cursor branding", () => {
  it("returns ASCII art header with correct format", () => {
    const header = getBrandingHeader();
    // ASCII art uses block characters, check for structure
    expect(header.length).toBeGreaterThan(50);
    const lines = header.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    // Verify it contains ASCII block characters
    expect(header).toMatch(/[▄██▀]/);
  });
});
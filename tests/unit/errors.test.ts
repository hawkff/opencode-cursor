import { describe, expect, it } from "bun:test";

import {
  parseAgentError,
  isRecoverableError,
  formatErrorForUser,
  stripAnsi,
} from "../../src/utils/errors.js";

describe("parseAgentError", () => {
  it("classifies quota errors as non-recoverable", () => {
    const err = parseAgentError("You've hit your usage limit for claude-3.5-sonnet");
    expect(err.type).toBe("quota");
    expect(err.recoverable).toBe(false);
    expect(err.userMessage).toContain("usage limit");
  });

  it("classifies auth errors as non-recoverable", () => {
    const err = parseAgentError("Error: not logged in");
    expect(err.type).toBe("auth");
    expect(err.recoverable).toBe(false);
  });

  it("classifies network errors as recoverable", () => {
    const err = parseAgentError("Error: fetch failed ECONNREFUSED");
    expect(err.type).toBe("network");
    expect(err.recoverable).toBe(true);
  });

  it("classifies model errors as non-recoverable", () => {
    const err = parseAgentError("Cannot use this model: gpt-5");
    expect(err.type).toBe("model");
    expect(err.recoverable).toBe(false);
  });

  it("classifies unknown timeout errors as recoverable", () => {
    const err = parseAgentError("request timeout after 30s");
    expect(err.type).toBe("unknown");
    expect(err.recoverable).toBe(true);
  });

  it("classifies unknown ETIMEDOUT errors as recoverable", () => {
    const err = parseAgentError("connect ETIMEDOUT 1.2.3.4:443");
    expect(err.type).toBe("unknown");
    expect(err.recoverable).toBe(true);
  });

  it("classifies generic unknown errors as non-recoverable", () => {
    const err = parseAgentError("something went wrong");
    expect(err.type).toBe("unknown");
    expect(err.recoverable).toBe(false);
  });

  it("extracts quota details when present", () => {
    const err = parseAgentError(
      "You've hit your usage limit. You saved $5.50. Reset on 02/15/2026. Continue with claude.",
    );
    expect(err.type).toBe("quota");
    expect(err.details.savings).toBe("$5.50");
    expect(err.details.resetDate).toBe("02/15/2026");
  });

  it("extracts model details when present", () => {
    const err = parseAgentError(
      "Cannot use this model: gpt-5. Available models: auto, claude-3.5-sonnet, gpt-4o",
    );
    expect(err.details.requested).toBe("gpt-5");
    expect(err.details.available).toBeDefined();
  });

  it("handles non-string input", () => {
    const err = parseAgentError(null);
    expect(err.type).toBe("unknown");
    expect(err.recoverable).toBe(false);
  });

  it("handles empty string", () => {
    const err = parseAgentError("");
    expect(err.type).toBe("unknown");
    expect(err.userMessage).toBe("An error occurred");
  });
});

describe("isRecoverableError", () => {
  it("returns true for network errors", () => {
    const err = parseAgentError("ECONNREFUSED 127.0.0.1:443");
    expect(isRecoverableError(err)).toBe(true);
  });

  it("returns false for auth errors", () => {
    const err = parseAgentError("not logged in");
    expect(isRecoverableError(err)).toBe(false);
  });

  it("returns false for quota errors", () => {
    const err = parseAgentError("hit your usage limit");
    expect(isRecoverableError(err)).toBe(false);
  });

  it("returns false for model errors", () => {
    const err = parseAgentError("model not found");
    expect(isRecoverableError(err)).toBe(false);
  });

  it("returns true for timeout in unknown category", () => {
    const err = parseAgentError("operation timeout");
    expect(isRecoverableError(err)).toBe(true);
  });

  it("returns false for generic unknown errors", () => {
    const err = parseAgentError("segfault");
    expect(isRecoverableError(err)).toBe(false);
  });
});

describe("formatErrorForUser", () => {
  it("formats basic error", () => {
    const err = parseAgentError("not logged in");
    const msg = formatErrorForUser(err);
    expect(msg).toContain("cursor-acp error");
    expect(msg).toContain("Not authenticated");
    expect(msg).toContain("Suggestion:");
  });

  it("formats error with details", () => {
    const err = parseAgentError("Cannot use this model: gpt-5");
    const msg = formatErrorForUser(err);
    expect(msg).toContain("gpt-5");
  });
});

describe("stripAnsi", () => {
  it("strips ANSI codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("handles non-string input", () => {
    expect(stripAnsi(42 as any)).toBe("42");
    expect(stripAnsi(null as any)).toBe("");
  });
});

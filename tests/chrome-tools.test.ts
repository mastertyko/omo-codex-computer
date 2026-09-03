import { Value } from "typebox/value";
import { describe, expect, it, vi } from "vitest";
import type { ChromeRuntime } from "../src/chrome-runtime";
import { CHROME_TOOL_NAMES, registerChromeTools } from "../src/chrome-tools";
import type { ChromeResult } from "../src/chrome-transport";

type RegisteredTool = {
  name: string;
  exposure?: string;
  allowLazyActivation?: boolean;
  executionMode?: string;
  parameters: Parameters<typeof Value.Check>[0];
  prepareArguments?: (args: unknown) => unknown;
  execute: (...args: unknown[]) => Promise<unknown>;
};

function createFakePi() {
  const tools: RegisteredTool[] = [];
  return {
    tools,
    registerTool(tool: RegisteredTool): void {
      tools.push(tool);
    },
  };
}

function getTool(pi: ReturnType<typeof createFakePi>, name: string): RegisteredTool {
  const tool = pi.tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function runtimeReturning(result: ChromeResult) {
  return {
    open: vi.fn(async () => result),
    observe: vi.fn(async () => result),
    act: vi.fn(async () => result),
  };
}

describe("OMO Chrome tools", () => {
  it("registers three searchable sequential tools", () => {
    // Given: an OMO ExtensionAPI registration seam.
    const pi = createFakePi();

    // When: Chrome tools register.
    registerChromeTools(
      pi as never,
      runtimeReturning({ kind: "opened" }) as unknown as ChromeRuntime,
    );

    // Then: the catalog and OMO exposure are exact.
    expect(pi.tools.map((tool) => tool.name)).toEqual(CHROME_TOOL_NAMES);
    expect(pi.tools).toHaveLength(3);
    expect(pi.tools.every((tool) => tool.exposure === "search")).toBe(true);
    expect(pi.tools.every((tool) => tool.allowLazyActivation === true)).toBe(true);
    expect(pi.tools.every((tool) => tool.executionMode === "sequential")).toBe(true);
  });

  it("accepts only the finite structural action surface", () => {
    // Given: the registered Chrome action schema.
    const pi = createFakePi();
    registerChromeTools(
      pi as never,
      runtimeReturning({ kind: "opened" }) as unknown as ChromeRuntime,
    );
    const schema = getTool(pi, "chrome_act").parameters;
    const target = { kind: "role", role: "button", name: "Continue" };

    // When/Then: supported actions pass and unsafe shapes fail.
    expect(Value.Check(schema, { action: { kind: "click", target } })).toBe(true);
    expect(Value.Check(schema, { action: { kind: "fill", target, value: "hello" } })).toBe(true);
    expect(Value.Check(schema, { action: { kind: "close" } })).toBe(true);
    expect(Value.Check(schema, {
      action: { kind: "click", target, selector: "#danger" },
    })).toBe(false);
    expect(Value.Check(schema, {
      action: { kind: "press", target, key: "Ctrl+R" },
    })).toBe(false);
    expect(Value.Check(schema, { action: { kind: "unsupported" } })).toBe(false);
  });

  it("rejects unsafe URL and UTF-8 inputs before dispatch", () => {
    // Given: OMO argument preparation for Chrome.
    const pi = createFakePi();
    registerChromeTools(
      pi as never,
      runtimeReturning({ kind: "opened" }) as unknown as ChromeRuntime,
    );
    const prepareOpen = getTool(pi, "chrome_open").prepareArguments;
    const prepareAct = getTool(pi, "chrome_act").prepareArguments;

    // When/Then: safe values survive and semantic boundary violations throw.
    expect(prepareOpen?.({ url: "https://example.com/" })).toEqual({
      url: "https://example.com/",
    });
    expect(() => prepareOpen?.({ url: "javascript:alert(1)" })).toThrow();
    expect(() => prepareOpen?.({ url: "https://user:pass@example.com/" })).toThrow();
    expect(() => prepareAct?.({
      action: {
        kind: "click",
        target: { kind: "text", text: "Å".repeat(600) },
      },
    })).toThrow();
    expect(() => prepareAct?.({
      action: {
        kind: "fill",
        target: { kind: "label", label: "Name" },
        value: "Å".repeat(20_000),
      },
    })).toThrow();
  });

  it("dispatches once and returns only safe result fields", async () => {
    // Given: a Chrome runtime snapshot.
    const runtime = runtimeReturning({
      kind: "snapshot",
      text: "Visible page text",
      truncated: true,
      byteLength: 123,
    });
    const pi = createFakePi();
    registerChromeTools(pi as never, runtime as unknown as ChromeRuntime);
    const ctx = { cwd: "/tmp/project" };
    const action = { kind: "click", target: { kind: "text", text: "Continue" } };

    // When: OMO executes one action.
    const result = await getTool(pi, "chrome_act")
      .execute("call-1", { action }, undefined, undefined, ctx);

    // Then: dispatch and output are constrained.
    expect(runtime.act).toHaveBeenCalledOnce();
    expect(runtime.act).toHaveBeenCalledWith(ctx, action);
    expect(result).toEqual({
      content: [{ type: "text", text: "Visible page text" }],
      details: { kind: "snapshot", truncated: true, byteLength: 123 },
    });
    expect(JSON.stringify(result)).not.toContain("tab");
  });
});

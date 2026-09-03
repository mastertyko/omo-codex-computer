import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPUTER_USE_TOOL_NAMES } from "../src/computer-use-tools";
import omoCodexComputer from "../src/index";

const runtimeMock = vi.hoisted(() => {
  const instances: FakeRuntime[] = [];

  class FakeRuntime {
    setContext = vi.fn();
    resetSession = vi.fn();
    shutdown = vi.fn(async () => {});
    callTool = vi.fn(async () => ({
      content: [{ type: "text", text: "Finder" }],
    }));

    constructor() {
      instances.push(this);
    }
  }

  return { FakeRuntime, instances };
});

vi.mock("../src/runtime", () => ({
  ComputerUseRuntime: runtimeMock.FakeRuntime,
}));

function createFakePi() {
  const tools: Array<{
    name: string;
    execute: (...args: unknown[]) => Promise<unknown>;
  }> = [];
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();

  return {
    tools,
    handlers,
    registerTool(tool: {
      name: string;
      execute: (...args: unknown[]) => Promise<unknown>;
    }): void {
      tools.push(tool);
    },
    registerCommand(): void {},
    registerFlag(): void {},
    getFlag(): undefined {
      return undefined;
    },
    on(event: string, handler: (event: unknown, ctx: unknown) => unknown): void {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    getActiveTools(): string[] {
      return ["read"];
    },
    setActiveTools(): void {},
    sendMessage(): void {},
  };
}

beforeEach(() => {
  runtimeMock.instances.length = 0;
});

describe("OMO Computer Use host dispatch", () => {
  it("registers and executes list-apps through the session runtime", async () => {
    // Given: the OMO extension factory and a host registration seam.
    const pi = createFakePi();
    const ctx = {
      cwd: "/tmp/project",
      hasUI: false,
      sessionManager: { getSessionId: () => "omo-session-1" },
    };

    // When: the extension starts a session and invokes list-apps.
    omoCodexComputer(pi as never);
    await pi.handlers.get("session_start")?.[0]?.(
      { type: "session_start", reason: "startup" },
      ctx,
    );
    const tool = pi.tools.find((entry) => entry.name === "computer_use_list_apps");
    const result = await tool?.execute("call-1", {}, undefined, undefined, ctx);

    // Then: all native tools exist and dispatch through the bound runtime.
    expect(
      pi.tools
        .map((entry) => entry.name)
        .filter((name) => name.startsWith("computer_use_")),
    ).toEqual(COMPUTER_USE_TOOL_NAMES);
    expect(runtimeMock.instances).toHaveLength(1);
    expect(runtimeMock.instances[0]?.setContext).toHaveBeenCalledWith(ctx);
    expect(runtimeMock.instances[0]?.resetSession).toHaveBeenCalledOnce();
    expect(runtimeMock.instances[0]?.callTool).toHaveBeenCalledWith(ctx, "list_apps", {});
    expect(result).toMatchObject({
      content: [{ type: "text", text: "Finder" }],
    });
  });
});

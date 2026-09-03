import { describe, expect, it, vi } from "vitest";
import { createWritePermissionGuard } from "../src/permissions";

function createContext(options: {
  hasUI: boolean;
  mode?: "tui" | "print";
  approved?: boolean;
  reject?: boolean;
}) {
  const confirm = options.reject
    ? vi.fn(async () => {
      throw new Error("dialog failed");
    })
    : vi.fn(async () => options.approved ?? false);
  return {
    mode: options.mode ?? (options.hasUI ? "tui" : "print"),
    hasUI: options.hasUI,
    ui: { confirm },
    confirm,
  };
}

describe("OMO write permission guard", () => {
  const guard = createWritePermissionGuard();

  it("allows read tools without a plugin confirmation", async () => {
    // Given: a read-only Computer Use call.
    const ctx = createContext({ hasUI: true });

    // When: permission is evaluated.
    const result = await guard(
      { toolName: "computer_use_list_apps", input: {} },
      ctx as never,
    );

    // Then: the call passes without prompting.
    expect(result).toBeUndefined();
    expect(ctx.confirm).not.toHaveBeenCalled();
  });

  it("allows an explicitly confirmed write tool", async () => {
    // Given: an interactive accepted Chrome mutation.
    const ctx = createContext({ hasUI: true, approved: true });

    // When: permission is evaluated.
    const result = await guard(
      { toolName: "chrome_act", input: { action: { kind: "click" } } },
      ctx as never,
    );

    // Then: one confirmation admits the call.
    expect(result).toBeUndefined();
    expect(ctx.confirm).toHaveBeenCalledOnce();
  });

  it.each([
    ["rejected", createContext({ hasUI: true, approved: false })],
    ["no UI", createContext({ hasUI: false })],
    ["dialog failure", createContext({ hasUI: true, reject: true })],
  ])("blocks write tools on %s", async (_case, ctx) => {
    // Given: a mutating desktop call without successful confirmation.
    // When: permission is evaluated.
    const result = await guard(
      { toolName: "computer_use_click", input: { app: "Finder" } },
      ctx as never,
    );

    // Then: execution is blocked fail-closed.
    expect(result).toMatchObject({ block: true });
  });

  it("allows headless writes only through an explicit host override", async () => {
    // Given: the host explicitly selected full-access for this process.
    const headlessGuard = createWritePermissionGuard({
      allowNonInteractiveWrites: () => true,
    });
    const ctx = createContext({ hasUI: false });

    // When: a Chrome mutation is evaluated without UI.
    const result = await headlessGuard(
      { toolName: "chrome_open", input: { url: "https://example.com/" } },
      ctx as never,
    );

    // Then: the explicit host override admits the call without a dialog.
    expect(result).toBeUndefined();
    expect(ctx.confirm).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ComputerUseRuntime, shouldDevAutoAccept } from "../src/runtime";

const STATUS_ENV = "OMO_CODEX_COMPUTER_STATUS";
const AUTO_ACCEPT_ENV = "OMO_CODEX_COMPUTER_DEV_AUTO_ACCEPT_APPS";

afterEach(() => {
  delete process.env[STATUS_ENV];
  delete process.env[AUTO_ACCEPT_ENV];
});

describe("OMO Computer Use runtime configuration", () => {
  it("reads the OMO status namespace", () => {
    // Given: OMO disables the footer status before runtime creation.
    process.env[STATUS_ENV] = "off";
    const setStatus = vi.fn();
    const runtime = new ComputerUseRuntime();

    // When: the runtime receives its OMO context.
    runtime.setContext({
      hasUI: true,
      ui: { setStatus },
    } as never);

    // Then: it clears the status instead of rendering an OMO default.
    expect(setStatus).toHaveBeenCalledWith("codex-computer", undefined);
  });

  it("reads the OMO development permission namespace", () => {
    // Given: one explicitly allowed application in the OMO namespace.
    process.env[AUTO_ACCEPT_ENV] = "Finder";

    // When/Then: only the matching upstream permission is admitted.
    expect(shouldDevAutoAccept('Allow Computer Use to use "Finder"?')).toBe(true);
    expect(shouldDevAutoAccept('Allow Computer Use to use "Notes"?')).toBe(false);
  });
});

import type { ExtensionContext } from "@code-yeongyu/senpi";
import { CHROME_WRITE_TOOL_NAMES } from "./chrome-tools";
import { COMPUTER_USE_WRITE_TOOL_NAMES } from "./computer-use-tools";

const WRITE_TOOL_NAMES = new Set<string>([
  ...COMPUTER_USE_WRITE_TOOL_NAMES,
  ...CHROME_WRITE_TOOL_NAMES,
]);

interface PermissionEvent {
  readonly toolName: string;
  readonly input: unknown;
}

interface WritePermissionGuardOptions {
  readonly allowNonInteractiveWrites?: () => boolean;
}

interface BlockedToolCall {
  readonly block: true;
  readonly reason: string;
}

type PermissionContext = Pick<ExtensionContext, "hasUI" | "ui">;

export function createWritePermissionGuard(
  options: WritePermissionGuardOptions = {},
): (
  event: PermissionEvent,
  ctx: PermissionContext,
) => Promise<BlockedToolCall | undefined> {
  return async (event, ctx) => {
    if (!WRITE_TOOL_NAMES.has(event.toolName)) return undefined;

    if (!ctx.hasUI) {
      return options.allowNonInteractiveWrites?.() === true
        ? undefined
        : block("Write-capable Codex automation requires interactive confirmation");
    }

    try {
      const approved = await ctx.ui.confirm(
        "Allow Codex automation?",
        `Allow ${event.toolName} to modify the desktop or browser?`,
      );
      return approved ? undefined : block("Codex automation write rejected by user");
    } catch {
      return block("Codex automation write confirmation failed");
    }
  };
}

function block(reason: string): BlockedToolCall {
  return { block: true, reason };
}

import type { ExtensionAPI, ExtensionContext } from "@code-yeongyu/senpi";
import { Type, type TSchema } from "typebox";
import type { ChromeRuntime } from "./chrome-runtime";
import type { ChromeAction, ChromeResult } from "./chrome-transport";

export const CHROME_TOOL_NAMES = Object.freeze([
  "chrome_open",
  "chrome_observe",
  "chrome_act",
] as const);
export const CHROME_WRITE_TOOL_NAMES = Object.freeze([
  "chrome_open",
  "chrome_act",
] as const);

type ChromeToolName = (typeof CHROME_TOOL_NAMES)[number];

type ChromeToolDetails = {
  kind: ChromeResult["kind"];
  truncated: boolean;
  byteLength: number;
};

const TOOLS = [
  {
    name: "chrome_open",
    label: "Open Chrome",
    description: "Open the single agent-owned Chrome tab for an explicit web task.",
    keywords: ["browser", "Chrome", "open tab", "navigate"],
  },
  {
    name: "chrome_observe",
    label: "Observe Chrome",
    description: "Read the current snapshot from the single agent-owned Chrome tab.",
    keywords: ["browser", "Chrome", "snapshot", "page"],
  },
  {
    name: "chrome_act",
    label: "Act in Chrome",
    description: "Perform one safe, explicit action in the single agent-owned Chrome tab.",
    keywords: ["browser", "Chrome", "click", "fill", "navigate"],
  },
] as const satisfies ReadonlyArray<{
  name: ChromeToolName;
  label: string;
  description: string;
  keywords: readonly string[];
}>;

export function registerChromeTools(pi: ExtensionAPI, runtime: ChromeRuntime): void {
  const schemas = createParameterSchemas();

  for (const tool of TOOLS) {
    const definition = {
      name: tool.name,
      label: tool.label,
      description: tool.description,
      exposure: "search",
      searchText: tool.description,
      searchKeywords: tool.keywords,
      searchGroup: "codex-computer",
      allowLazyActivation: true,
      executionMode: "sequential",
      parameters: schemas[tool.name],
      prepareArguments: (args: unknown) => prepareChromeArguments(tool.name, args),
      async execute(
        _toolCallId: string,
        params: unknown,
        signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: ExtensionContext,
      ) {
        let result: ChromeResult;
        switch (tool.name) {
          case "chrome_open": {
            const openParams = params as { url?: string };
            result = await runtime.open(ctx, openParams.url, signal);
            break;
          }
          case "chrome_observe": {
            const observeParams = params as { offset?: number };
            result = await runtime.observe(ctx, observeParams.offset, signal);
            break;
          }
          case "chrome_act": {
            const actParams = params as { action: ChromeAction };
            result = signal
              ? await runtime.act(ctx, actParams.action, signal)
              : await runtime.act(ctx, actParams.action);
            break;
          }
        }
        return shapeResult(result);
      },
    };
    pi.registerTool(definition as Parameters<ExtensionAPI["registerTool"]>[0]);
  }
}

function createParameterSchemas(): Record<ChromeToolName, TSchema> {
  const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
    Type.Object(properties, { additionalProperties: false });
  const semanticText = (description: string) =>
    Type.String({ minLength: 1, maxLength: 1024, description });
  const locator = Type.Union([
    strictObject({
      kind: Type.Literal("role"),
      role: semanticText("The semantic ARIA role."),
      name: Type.Optional(semanticText("The accessible name, when needed.")),
    }),
    strictObject({ kind: Type.Literal("text"), text: semanticText("The visible text to match.") }),
    strictObject({ kind: Type.Literal("label"), label: semanticText("The form label to match.") }),
    strictObject({
      kind: Type.Literal("placeholder"),
      placeholder: semanticText("The placeholder to match."),
    }),
    strictObject({ kind: Type.Literal("test_id"), testId: semanticText("The test id to match.") }),
  ], {
    description: "A semantic page target; selectors, regexes, coordinates, and indexes are not supported.",
  });
  const url = Type.String({
    minLength: 1,
    maxLength: 2048,
    description: "An absolute http(s) URL without credentials or whitespace.",
  });
  const key = stringEnum([
    "Enter", "Tab", "Shift+Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft",
    "ArrowRight", "Home", "End", "PageUp", "PageDown", "Backspace", "Delete", "Space",
  ]);
  const action = Type.Union([
    strictObject({ kind: Type.Literal("navigate"), url }),
    strictObject({ kind: Type.Literal("back") }),
    strictObject({ kind: Type.Literal("forward") }),
    strictObject({ kind: Type.Literal("reload") }),
    strictObject({ kind: Type.Literal("click"), target: locator }),
    strictObject({
      kind: Type.Literal("fill"),
      target: locator,
      value: Type.String({ maxLength: 32768 }),
    }),
    strictObject({ kind: Type.Literal("press"), target: locator, key }),
    strictObject({ kind: Type.Literal("select"), target: locator, option: semanticText("Option label.") }),
    strictObject({ kind: Type.Literal("check"), target: locator, checked: Type.Boolean() }),
    strictObject({ kind: Type.Literal("close") }),
  ], { description: "One finite Chrome action; no raw JavaScript, CDP, selectors, or arbitrary keys." });

  return {
    chrome_open: strictObject({ url: Type.Optional(url) }),
    chrome_observe: strictObject({
      offset: Type.Optional(Type.Integer({ minimum: 1, maximum: 1_000_000 })),
    }),
    chrome_act: strictObject({ action }),
  };
}

function stringEnum(values: readonly string[]): TSchema {
  return Type.Union(values.map((value) => Type.Literal(value)));
}

function prepareChromeArguments(toolName: ChromeToolName, args: unknown): Record<string, unknown> {
  if (!isRecord(args)) throw new Error("Chrome tool arguments must be an object");

  if (toolName === "chrome_open" && typeof args.url === "string") validateUrl(args.url);
  if (toolName !== "chrome_act" || !isRecord(args.action)) return args;

  const action = args.action;
  if (action.kind === "navigate" && typeof action.url === "string") validateUrl(action.url);
  if (typeof action.value === "string") validateUtf8(action.value, 32768, "fill value");
  if (typeof action.option === "string") validateUtf8(action.option, 1024, "option");
  if (isRecord(action.target)) validateLocator(action.target);
  return args;
}

function validateLocator(locator: Record<string, unknown>): void {
  for (const key of ["role", "name", "text", "label", "placeholder", "testId"]) {
    const value = locator[key];
    if (typeof value === "string") validateUtf8(value, 1024, `locator ${key}`);
  }
}

function validateUrl(value: string): void {
  validateUtf8(value, 2048, "URL");
  if (/[\u0000-\u0020\u007f]/u.test(value)) throw new Error("Chrome URL contains whitespace");
  const parsed = new URL(value);
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || parsed.username !== ""
    || parsed.password !== ""
  ) {
    throw new Error("Chrome URL must use http(s) without credentials");
  }
}

function validateUtf8(value: string, maxBytes: number, field: string): void {
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error(`${field} exceeds ${maxBytes} UTF-8 bytes`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shapeResult(
  result: ChromeResult,
): { content: [{ type: "text"; text: string }]; details: ChromeToolDetails } {
  switch (result.kind) {
    case "snapshot":
      return {
        content: [{ type: "text", text: result.text }],
        details: { kind: "snapshot", truncated: result.truncated, byteLength: result.byteLength },
      };
    case "opened":
      return {
        content: [{ type: "text", text: "Chrome tab opened." }],
        details: { kind: "opened", truncated: false, byteLength: 0 },
      };
    case "closed":
      return {
        content: [{ type: "text", text: "Chrome tab closed." }],
        details: { kind: "closed", truncated: false, byteLength: 0 },
      };
  }
}

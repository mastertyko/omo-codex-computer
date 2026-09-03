# Contributing

`omo-codex-computer` is intentionally small. Prefer direct, tested changes over
new abstractions.

## Requirements

- macOS for live Computer Use and Chrome smoke tests
- OMO Native
- Bun 1.3 or newer
- Node.js 24 or newer
- Codex CLI on `PATH`
- ChatGPT desktop support for Codex Computer Use
- Google Chrome and the connected official ChatGPT extension for Chrome smoke tests

## Local workflow

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run qa:host
```

Use `bun run test:watch` while iterating. Load the working tree through the real
host with `omo -e .`.

Before submitting a change:

1. Write the failing behavioral test first.
2. Keep TypeScript and the complete Vitest suite green.
3. Run `bun run qa:host`.
4. Run the affected live OMO Computer Use or Chrome path.
5. Run `npm pack --dry-run` and inspect packaged resources.
6. Update README and packaged skills when public behavior changes.

## OMO extension boundaries

- Import only the public `@code-yeongyu/senpi` API.
- Build tool schemas with TypeBox.
- Keep the tools searchable unless explicit activation is required.
- Use `agent_settled`, not `agent_end`, for terminal run cleanup.
- Keep `session_shutdown` cleanup idempotent.
- Interactive write tools require the plugin confirmation guard.
- Print/RPC writes defer to OMO's permission preset and rules.
- Native Computer Use no-UI elicitation declines.
- Chrome elicitation always declines.

Do not import OMO's generated `plugin/extensions` or `plugin/runtime`
internals. They are private build artifacts, not third-party APIs.

## Automation invariants

- Never expose raw JavaScript, `node_repl`, CDP, browser handles, existing-tab
  discovery, selectors, credentials, history, uploads, or downloads.
- Never replay a possibly dispatched side effect.
- Never fall back from Chrome to Computer Use, CDP, another browser, or another tab.
- Sky may fall back to direct MCP only before dispatch.
- Preserve Chrome's one-owned-tab identity and poisoned-run state.
- Keep snapshot caps, locator ambiguity checks, and cleanup ordering intact.
- Never log app/page content, screenshots, credentials, headers, tokens,
  cookies, API keys, or session identifiers.

Expand the app-server allowlist only after reviewing the experimental protocol,
running focused compatibility tests, and completing a real
open/observe/action/close probe.

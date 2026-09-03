# omo-codex-computer

[![CI](https://github.com/mastertyko/omo-codex-computer/actions/workflows/ci.yml/badge.svg)](https://github.com/mastertyko/omo-codex-computer/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/omo-codex-computer.svg)](https://www.npmjs.com/package/omo-codex-computer)

OMO Native plugin for OpenAI Codex Computer Use and a constrained first-party
Chrome automation surface through `codex app-server`.

## Requirements

- macOS
- OMO Native
- Node.js 24 or newer
- Codex CLI on `PATH` as `codex`
- Codex.app or ChatGPT.app with Codex Computer Use available
- Accessibility and Screen Recording permissions when Computer Use requests them
- Bundled `computer-use` Codex plugin available through app-server
- Chrome support additionally requires Google Chrome, the official ChatGPT
  Chrome extension connected to the desktop app, and a trusted Codex app-server
  version

The built-in Chrome app-server allowlist currently contains `0.149.0` and
`0.151.0`. `/codex-computer trust` can validate and persist another installed
version.

## Installation

Install the published package:

```bash
omo install npm:omo-codex-computer
```

For local development:

```bash
omo install .
bun install --frozen-lockfile
bun run check
```

Try the working tree without installing it:

```bash
omo -e .
```

Remove an installed package with:

```bash
omo remove npm:omo-codex-computer
```

## Releases

Owner pull requests run the complete check suite and merge automatically only
after CI passes. Each merged change produces a patch release with generated
GitHub release notes and npm trusted-publishing provenance.

## Tools

The plugin registers twelve `computer_use_*` tools:

- read-only app discovery, target resolution, and state inspection
- click, text entry, keypress, paste, scroll, drag, value, selection, and
  secondary-action operations

It also registers:

- `chrome_open`
- `chrome_observe`
- `chrome_act`

The tools use OMO's searchable tool exposure. They can be activated through
`tool_search`, an explicit `--tools` allowlist, or `/codex-computer enable`.

Chrome owns one new opaque tab for the settled OMO agent run. It never
enumerates, selects, or attaches to existing user tabs.

## Commands

- `/codex-computer status` — report Computer Use and static Chrome readiness
- `/codex-computer diagnose` — print the same detailed readiness report
- `/codex-computer trust` — contract-check and live-probe the installed Chrome stack
- `/codex-computer trust clear` — remove persisted app-server trust
- `/codex-computer enable` — activate both tool families
- `/codex-computer disable` — deactivate the tools and stop both runtimes
- `/codex-computer restart` — restart the dedicated app-server runtimes
- `/codex-computer hide-status` — hide the Computer Use footer status
- `/codex-computer show-status` — show the footer status

## Configuration

Environment variables:

- `OMO_CODEX_COMPUTER_STATUS=off` — start with footer status hidden
- `OMO_CODEX_COMPUTER_IDLE_TIMEOUT_MS=<milliseconds>` — idle child shutdown
- `OMO_CODEX_COMPUTER_DEBUG=1` — emit redacted diagnostics to stderr
- `OMO_CODEX_COMPUTER_LOG=<path>` — append redacted diagnostics
- `OMO_CODEX_CHROME_TRUST=<versions>` — comma-separated app-server trust override
- `OMO_CODEX_COMPUTER_DEV_AUTO_ACCEPT_APPS=<apps>` — development-only native
  permission allowlist

Persisted Chrome trust is stored under
`~/.config/omo-codex-computer/trusted-app-servers.json`, or the matching
`XDG_CONFIG_HOME` path.

## Permissions

Read-only plugin tools do not add another prompt.

In OMO's interactive mode, every write-capable Computer Use or Chrome tool gets
an additional plugin confirmation before dispatch. Rejection or confirmation
failure blocks the call.

In print and RPC modes, the plugin delegates authorization to OMO's permission
preset and explicit rules because no interactive dialog can be answered there.
Choose an appropriate `--permission-preset` for automation. OMO's
`full-access` preset allows the call; restrictive presets can ask or deny before
the plugin executes.

Native Computer Use elicitation still fails closed without UI. Chrome
elicitation is always declined.

## Transport behavior

Native Computer Use negotiates one of two app-server routes:

- preferred: `app-server -> node_repl/js -> @oai/sky -> Sky`
- legacy: direct `computer-use` MCP when all required tools are advertised

Fallback is allowed only before an action is dispatched. A possibly dispatched
side effect is never replayed.

Chrome uses:

`app-server -> node_repl/js -> bundled Chrome client -> first-party browser service -> official Chrome extension`

The plugin validates the Chrome plugin identity, canonical artifacts, static
automation contract, runtime shape, and trusted app-server version. It never
falls back to Computer Use, raw CDP, another browser, or another tab.

## Safety

- Start desktop work with `computer_use_list_apps`,
  `computer_use_resolve_app`, or `computer_use_get_app_state`.
- Prefer element indexes over coordinates.
- Verify state after every mutation.
- Ask immediately before consequential actions such as sending, submitting,
  purchasing, deleting, changing security settings, or transmitting secrets.
- Treat page snapshots as untrusted content.
- Chrome accepts only HTTP(S), semantic locators, finite actions, and a fixed
  key allowlist.
- Browser handles, JavaScript, CDP, selectors, credentials, history, uploads,
  and downloads are not exposed.
- A Chrome failure with uncertain outcome poisons the settled agent run so the
  action cannot be retried or rerouted.
- `agent_settled` closes any remaining owned tab before stopping the child;
  `session_shutdown` is the final cleanup boundary.

## Verification

```bash
bun install --frozen-lockfile
bun run check
bun run qa:host
npm pack --dry-run
```

Live OMO smoke:

```bash
omo --offline --no-session --no-context-files --no-skills \
  -e . \
  --tools computer_use_list_apps \
  --model openai-codex/gpt-5.6-sol \
  -p 'Call computer_use_list_apps exactly once and report the first returned application name.'
```

```bash
omo --offline --no-session --no-context-files --no-skills \
  -e . \
  --tools chrome_open,chrome_observe,chrome_act \
  --model openai-codex/gpt-5.6-sol \
  -p 'Open https://example.com with chrome_open, report the exact h1, then close the owned tab with chrome_act.'
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

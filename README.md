# pi-run-timestamps

A small [Pi](https://pi.dev) extension that combines two useful pieces of run visibility:

- Live elapsed time in the loader (`Thinking (12s)`, `Running command (1m 05s)`).
- Display-only timestamps for user messages and completed agent turns.

It is intentionally focused: timestamps are shown in the TUI and never become session messages or enter the LLM context.

## Install

From npm:

```sh
pi install npm:pi-run-timestamps
```

From a local checkout during development:

```sh
pi install /path/to/pi-run-timestamps
```

Pi loads the extension declared by the package manifest automatically.

## What it displays

After a user message:

```text
Sent 14:32:05
```

After the complete agent turn settles:

```text
Done at 14:33:18 · 1m 13s
```

The completion timer starts at the first `agent_start` and ends at `agent_settled`. This includes tool calls, automatic retries, compaction recovery, and queued continuations that belong to the same turn.

While Pi is working, the loader includes its elapsed time:

```text
Thinking (12s)
```

## Design notes

- Notifications are display-only and do not pollute the model context.
- Timestamps use the local 24-hour clock with second precision.
- Reloading the extension does not intentionally duplicate the loader patch.
- The loader patch is defensive: if Pi's loader API is unavailable or incompatible, timestamps continue to work and only the live loader enhancement is skipped.
- There is currently no configuration; the extension stays deliberately small.

## Development

The package contains a single TypeScript extension entry point:

```text
index.ts
```

The extension relies on Pi's public lifecycle events. The live loader elapsed time uses a small defensive patch to the `Loader` display update, matching the behavior of Pi's loader without adding a separate UI component.

## License

MIT

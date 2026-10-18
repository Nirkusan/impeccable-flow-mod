# impeccable-flow

A Claude Code mod that tracks the `impeccable` design lifecycle and suggests the next command.

- **Pane** (local sessions): buttons for New component, Full redesign and Polish, the flow's steps marked done, current, to do or skipped, and the next command with a Copy button.
- **Text mode** (sessions that cannot draw a pane): `/impeccable-flow [component|redesign|polish|reset]` prints the same.
- Progress advances on every `/impeccable <command> <target>` you type or Claude runs.

## Install

At the prompt of a terminal session:

```
/plugin install impeccable-flow --marketplace Nirkusan/impeccable-flow
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install impeccable-flow --marketplace Nirkusan/impeccable-flow
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Nirkusan/impeccable-flow`, then Add plugin.

The repository is private, so your machine needs a git credential for github.com that can read it (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Develop

Load from a local checkout without installing:

```
claude --plugin-dir /path/to/impeccable-flow
```

Or, for the desktop app, add to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/impeccable-flow" } }
```

Run the tests with `claude plugin test .`.

# impeccable-flow

A Claude Code mod that tracks the `impeccable` design lifecycle and tells you which command to run next.

Pick a flow (new component, full redesign or polish), and the mod marks each step as you run `/impeccable <command> <target>`, whether you type it or Claude runs it. It then suggests the next command, with the target filled in.

## The flows

| Flow | Steps |
| --- | --- |
| New component | shape → craft → (onboard, animate, harden) → audit → polish → critique |
| Full redesign | critique → shape → craft → audit → polish → critique again |
| Polish | critique or audit → 1 or 2 targeted fixes → polish |

- `craft` runs `shape` itself, so running `craft` marks both done.
- A second `critique` right after the first is a re-run, not a jump to the final re-score.
- In the polish flow, the fix step lists the targeted commands to choose from: `layout`, `typeset`, `clarify`, `quieter`, `bolder`, `distill`, `colorize`, `adapt`, `harden`.

## Two ways it shows

**Pane** (local sessions in the terminal or the desktop app): a panel beside the conversation with a button for each flow, a Reset button, the steps, and the next command with a Copy button.

**Text** (sessions that cannot draw a pane, such as cloud sessions): the slash command prints the same information.

```
/impeccable-flow redesign

Full redesign
  › Critique
  ○ Shape
  ○ Craft
  ○ Audit
  ○ Polish
  ○ Critique (re-score)

Next: Critique
  /impeccable critique <target>
  Score the page and list the problems shape and craft will fix.
```

`✓` done, `›` current, `○` to do, `–` skipped.

## Commands

| Command | What it does |
| --- | --- |
| `/impeccable-flow` | Open the pane, or print the flow where no pane can be drawn |
| `/impeccable-flow component` | Choose the new-component flow |
| `/impeccable-flow redesign` | Choose the full-redesign flow |
| `/impeccable-flow polish` | Choose the polish flow |
| `/impeccable-flow reset` | Clear the flow and its progress |

## Install

At the prompt of a terminal session:

```
/plugin install impeccable-flow --marketplace Nirkusan/impeccable-flow-mod
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install impeccable-flow --marketplace Nirkusan/impeccable-flow-mod
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Nirkusan/impeccable-flow-mod`, then Add plugin.

## Develop

Load it from a local checkout without installing:

```
claude --plugin-dir /path/to/impeccable-flow-mod
```

For a session the desktop app starts, add this to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/impeccable-flow-mod" } }
```

Edits reload by themselves in a session that loads the folder this way.

Run the tests:

```
claude plugin test .
```

The step logic lives in `hooks/flows.ts`; the pane, the slash command and the hooks that record commands are in `hooks/register.tsx`.

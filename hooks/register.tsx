import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FlowId, Run } from '../types'
import { FLOWS, describeFlow, flowById, nextCommand, parseRun, progress } from './flows'

const PANE = 'impeccable-flow'
const TITLE = 'Impeccable flow'
const SKILL = /(^|:)impeccable$/

const flow = atom({ plugin: 'impeccable-flow', key: 'flow' } as const, null)
const runs = atom({ plugin: 'impeccable-flow', key: 'runs' } as const, [])

const record = async ($: EngineInterface, args: string) => {
  const run: Run | undefined = parseRun(args)

  if (run !== undefined) {
    await update($, runs, list => [...list, run].slice(-100))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'impeccable-flow',
      description: 'Show the impeccable lifecycle and the next step',
      argumentHint: '[component|redesign|polish|reset]',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'impeccable-flow' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'reset') {
      await update($, runs, () => [])
      await update($, flow, () => null)
    } else if (FLOWS.some(f => f.id === arg)) {
      await update($, flow, () => arg as FlowId)
    } else if (arg !== '') {
      return { text: `Unknown flow "${arg}". Use ${FLOWS.map(f => f.id).join(', ')} or reset.` }
    }

    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return { text: opened.isPlaced ? 'Impeccable flow pane opened.' : describeFlow(await read($, flow), await read($, runs)) }
  })

  // The person typing /impeccable <command> <target>.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined && SKILL.test(e.command.name)) {
      await record($, e.command.args)
    }

    return next(e)
  }).catch(($, e, next) => (next(e)))

  // Claude invoking the skill itself.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)

    if (SKILL.test(e.skill) && ran.deny === undefined && ran.isError !== true) {
      await record($, e.args ?? '')
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const chosen = await read($, flow)
    const list = await read($, runs)

    const picker = (
      <Box key="picker" flexDirection="row" gap={1}>
        {FLOWS.map(f => (
          <Button
            key={`flow-${f.id}`}
            label={f.label}
            variant={f.id === chosen ? 'primary' : 'secondary'}
            onPress={() => update($, flow, () => f.id)}
          />
        ))}
        <Button
          key="reset"
          label="Reset"
          dimColor
          onPress={async () => {
            await update($, runs, () => [])
            await update($, flow, () => null)
          }}
        />
      </Box>
    )

    if (chosen === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {picker}
          <Text dimColor>Choose a flow to see its steps.</Text>
        </Box>
      )
    }

    const { steps } = flowById(chosen)
    const p = progress(chosen, list)
    const command = nextCommand(p)

    return (
      <Box flexDirection="column" gap={1}>
        {picker}
        <Text key="target" dimColor>
          Target: {p.target === '' ? 'none yet' : p.target}
        </Text>
        <Box key="steps" flexDirection="column">
          {steps.map((step, i) => {
            const status = p.statuses[i]
            const mark = status === 'done' ? '✓' : status === 'current' ? '›' : status === 'skipped' ? '–' : '○'
            const optional = step.isOptional ? ' (optional)' : ''

            return (
              <Text
                key={`step-${i}`}
                bold={status === 'current'}
                dimColor={status === 'done' || status === 'skipped' || (status === 'todo' && step.isOptional === true)}
              >
                {mark} {step.label}
                {optional}
                {status === 'skipped' && !step.isOptional ? ' (skipped)' : ''}
              </Text>
            )
          })}
        </Box>
        {p.next && command ? (
          <Box key="next" flexDirection="column">
            <Text bold>Next: {p.next.step.label}</Text>
            <Text>{command}</Text>
            <Text dimColor>{p.next.step.hint}</Text>
            {p.optional.length > 0 && (
              <Text dimColor>Optional first: {p.optional.map(s => s.commands.length > 2 ? 'a second fix' : s.commands[0]).join(', ')}</Text>
            )}
            <Button
              key="copy"
              label="Copy command"
              onPress={press => $.ui.copy({ text: command, surface: press.surface })}
            />
          </Box>
        ) : (
          <Text key="next">Flow complete. Press Reset to start on another target.</Text>
        )}
      </Box>
    )
  })
}

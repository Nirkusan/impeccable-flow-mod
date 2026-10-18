import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Run } from '../types'
import { FLOWS, SKIP, commandFor, describeFlow, isFlowId, parseRun, summarize } from './flows'
import type { Summary } from './flows'

const PANE = 'impeccable-flow'
const TITLE = 'Impeccable flow'
const SKILL = /(^|:)impeccable$/

const flow = atom({ plugin: 'impeccable-flow', key: 'flow' } as const, null)
const runs = atom({ plugin: 'impeccable-flow', key: 'runs' } as const, [])
const target = atom({ plugin: 'impeccable-flow', key: 'target' } as const, '')

const remember = async ($: EngineInterface, run: Run) => {
  await update($, runs, list => [...list, run].slice(-100))
}

const record = async ($: EngineInterface, args: string) => {
  const run = parseRun(args)

  if (run === undefined) {
    return
  }

  const chosen = await read($, flow)
  const before = chosen && summarize(chosen, await read($, runs))
  await remember($, run)

  if (run.target !== '') {
    await update($, target, () => run.target)
  }

  if (chosen === null || before === null || before.isComplete) {
    return
  }

  const after = summarize(chosen, await read($, runs))

  if (after.requiredDone > before.requiredDone) {
    const done = before.next?.step.label ?? 'Step'
    $.ui.toast(after.next ? `${done} done. Next: ${after.next.step.label.toLowerCase()}` : `${done} done. Flow complete`)
  }
}

const copy = async ($: EngineInterface, text: string, surface: RenderSurface) => {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Command copied' : 'Copy failed, select the command above')
}

const BAR_WIDTH = 228

const progressBar = (s: Summary) => {
  const filled = Math.round((BAR_WIDTH * s.requiredDone) / Math.max(1, s.requiredTotal))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_WIDTH}" height="4" viewBox="0 0 ${BAR_WIDTH} 4"><rect width="${BAR_WIDTH}" height="4" rx="2" fill="#8080804d"/><rect width="${filled}" height="4" rx="2" fill="#d97757"/></svg>`
}

const textBar = (s: Summary, columns: number) => {
  const width = Math.max(8, Math.min(30, columns - 2))
  const filled = Math.round((width * s.requiredDone) / Math.max(1, s.requiredTotal))

  return '━'.repeat(filled) + '─'.repeat(width - filled)
}

const MARKS = { done: '✓', current: '●', skipped: '–', todo: '○' } as const

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
    } else if (isFlowId(arg)) {
      await update($, flow, () => arg)
    } else if (arg !== '') {
      return { text: `Unknown flow "${arg}". Use ${FLOWS.map(f => f.id).join(', ')} or reset.` }
    }

    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return {
      text: opened.isPlaced
        ? 'Impeccable flow pane opened.'
        : describeFlow(await read($, flow), await read($, runs), await read($, target)),
    }
  })

  // The person typing /impeccable <command> <target>.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined && SKILL.test(e.command.name)) {
      await record($, e.command.args)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Claude invoking the skill itself.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)

    if (SKILL.test(e.skill) && ran.deny === undefined && ran.isError !== true) {
      await record($, e.args ?? '')
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Button, Code, Text } = els
    // The mobile app draws no Input or Select, the terminal no Svg.
    const Input = e.surface !== 'mobile' && 'Input' in els ? els.Input : undefined
    const Select = e.surface !== 'mobile' && 'Select' in els ? els.Select : undefined
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    const chosen = await read($, flow)
    const list = await read($, runs)
    const page = await read($, target)

    const header = (
      <Box flexDirection="row" gap={1} alignItems="center">
        {Select ? (
          <Box flexGrow={1}>
            <Select
              key="flow"
              label="Flow"
              value={chosen ?? undefined}
              options={FLOWS.map(f => ({ value: f.id, label: f.label }))}
              onSelect={(value: string) => (isFlowId(value) ? update($, flow, () => value) : undefined)}
            />
          </Box>
        ) : (
          <Box flexGrow={1} flexDirection="row" flexWrap="wrap" gap={1}>
            {FLOWS.map(f => (
              <Button
                key={`flow-${f.id}`}
                label={f.label}
                variant={f.id === chosen ? 'primary' : 'secondary'}
                onPress={() => update($, flow, () => f.id)}
              />
            ))}
          </Box>
        )}
        <Button
          key="reset"
          label="Reset"
          dimColor
          onPress={async () => {
            await update($, runs, () => [])
            await update($, flow, () => null)
            await update($, target, () => '')
          }}
        />
      </Box>
    )

    if (chosen === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {FLOWS.map(f => (
            <Box key={`about-${f.id}`} flexDirection="column">
              <Text weight="semibold">{f.label}</Text>
              <Text dimColor>{f.summary}</Text>
            </Box>
          ))}
        </Box>
      )
    }

    const s = summarize(chosen, list)

    const targetField = Input ? (
      <Input
        key="target"
        label="Target"
        placeholder="Page or component, e.g. tailor"
        value={page}
        onInput={(value: string) => update($, target, () => value.trim())}
        onSubmit={(value: string) => update($, target, () => value.trim())}
      />
    ) : (
      <Text dimColor>{`Target: ${page === '' ? 'set by the next command you run' : page}`}</Text>
    )

    const next = s.next ? (
      <Box key="next" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text weight="bold" size="heading">
            {s.next.step.label}
          </Text>
          <Text dimColor size="footnote">
            {`Step ${s.stepNumber} of ${s.requiredTotal}`}
          </Text>
        </Box>
        {s.fixes ? (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>{s.next.step.hint}</Text>
            {s.fixes.map(fix => (
              <Box key={`fix-row-${fix.command}`} flexDirection="row" justifyContent="space-between" alignItems="center">
                <Box flexDirection="column">
                  <Text mono>{fix.command}</Text>
                  <Text dimColor size="caption">
                    {fix.use}
                  </Text>
                </Box>
                <Button
                  key={`fix-${fix.command}`}
                  label="Copy"
                  onPress={press => copy($, commandFor(fix.command, page), press.surface)}
                />
              </Box>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" gap={1}>
            <Code source={commandFor(s.next.command, page)} language="text" wrap="wrap" />
            <Text dimColor>{s.next.step.hint}</Text>
            <Button
              key="copy"
              label="Copy command"
              variant="primary"
              onPress={press => copy($, commandFor(s.next!.command, page), press.surface)}
            />
          </Box>
        )}
        <Button key="skip" label="Skip step" dimColor onPress={() => remember($, SKIP)} />
      </Box>
    ) : (
      <Box key="next" flexDirection="column" gap={1}>
        <Text weight="bold" size="heading">
          Flow complete
        </Text>
        <Text dimColor>
          {chosen === 'redesign'
            ? 'Compare the re-score against the first critique.'
            : 'Start again on this target, or change it first.'}
        </Text>
        <Button key="start-again" label="Start again" variant="primary" onPress={() => update($, runs, () => [])} />
      </Box>
    )

    const steps = (
      <Box key="steps" flexDirection="column">
        {s.rows.map((row, i) =>
          row.kind === 'step' ? (
            <Text
              key={`step-${i}`}
              weight={row.status === 'current' ? 'semibold' : 'regular'}
              color={row.status === 'current' ? 'claude' : undefined}
              dimColor={row.status === 'done' || row.status === 'skipped'}
              strikethrough={row.status === 'skipped'}
            >
              {`${MARKS[row.status]}  ${row.label}`}
            </Text>
          ) : (
            <Text key={`step-${i}`} dimColor size="footnote">
              {`+  Optional: ${row.items.map(item => (item.isRun ? `✓ ${item.label}` : item.label)).join(' · ')}`}
            </Text>
          ),
        )}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {targetField}
        {next}
        {Svg ? (
          <Svg
            source={progressBar(s)}
            alt={`${s.requiredDone} of ${s.requiredTotal} steps done`}
            width={BAR_WIDTH}
            height={4}
          />
        ) : (
          <Text dimColor>{textBar(s, e.props.bodyColumns)}</Text>
        )}
        {steps}
      </Box>
    )
  })
}

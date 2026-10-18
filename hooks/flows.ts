import type { FlowId, Run } from '../types'

export type Step = {
  label: string
  commands: readonly string[]
  hint: string
  isOptional?: true
  // A step whose command also does an earlier step (craft runs shape itself).
  covers?: readonly string[]
}

export type Flow = { id: FlowId; label: string; summary: string; steps: readonly Step[] }

export type Status = 'done' | 'skipped' | 'current' | 'todo'

export type Fix = { command: string; use: string }

// The targeted commands of the polish flow, in the order the pane lists them.
export const FIXES: readonly Fix[] = [
  { command: 'layout', use: 'Spacing, hierarchy' },
  { command: 'typeset', use: 'Type' },
  { command: 'clarify', use: 'Copy, error messages' },
  { command: 'distill', use: 'Cluttered' },
  { command: 'adapt', use: 'Phones and tablets' },
  { command: 'quieter', use: 'Too loud' },
  { command: 'bolder', use: 'Too bland' },
  { command: 'colorize', use: 'Flat or grey' },
  { command: 'harden', use: 'Edge cases' },
]

const TARGETED = FIXES.map(f => f.command)

// Recorded by the Skip button: the current step is passed over.
export const SKIP: Run = { command: '#skip', target: '' }

export const FLOWS: readonly Flow[] = [
  {
    id: 'component',
    label: 'Component',
    summary: 'Build something new: shape, craft, audit, polish.',
    steps: [
      { label: 'Shape', commands: ['shape'], hint: 'Pin down the brief. Skip it when the brief is clear: craft runs shape itself.' },
      { label: 'Craft', commands: ['craft'], covers: ['shape'], hint: 'Build the component.' },
      { label: 'Onboard', commands: ['onboard'], isOptional: true, hint: 'First-run and empty states.' },
      { label: 'Animate', commands: ['animate'], isOptional: true, hint: 'Motion.' },
      { label: 'Harden', commands: ['harden'], isOptional: true, hint: 'Errors and edge cases.' },
      { label: 'Audit', commands: ['audit'], hint: 'Accessibility, performance and responsive layout.' },
      { label: 'Polish', commands: ['polish'], hint: 'Final pass on the details.' },
      { label: 'Critique (baseline)', commands: ['critique'], hint: 'Record a baseline score for later.' },
    ],
  },
  {
    id: 'redesign',
    label: 'Redesign',
    summary: 'Critique first, rebuild, then re-score.',
    steps: [
      { label: 'Critique', commands: ['critique'], hint: 'Score the page and list the problems shape and craft will fix.' },
      { label: 'Shape', commands: ['shape'], hint: 'Plan the new structure from the critique findings.' },
      { label: 'Craft', commands: ['craft'], covers: ['shape'], hint: 'Build the redesign.' },
      { label: 'Audit', commands: ['audit'], hint: 'Accessibility, performance and responsive layout.' },
      { label: 'Polish', commands: ['polish'], hint: 'Final pass on the details.' },
      { label: 'Critique (re-score)', commands: ['critique'], hint: 'Re-score so the change can be measured.' },
    ],
  },
  {
    id: 'polish',
    label: 'Polish',
    summary: 'Diagnose, make 1 or 2 targeted fixes, polish.',
    steps: [
      { label: 'Critique or audit', commands: ['critique', 'audit'], hint: 'Critique for UX issues, audit for technical ones.' },
      { label: 'Fix', commands: TARGETED, hint: 'Pick what the critique found.' },
      { label: 'Second fix', commands: TARGETED, isOptional: true, hint: 'Pick what the critique found.' },
      { label: 'Polish', commands: ['polish'], hint: 'Final pass on the details.' },
    ],
  },
]

const ALL = new Set([
  ...FLOWS.flatMap(f => f.steps.flatMap(s => s.commands)),
  'init', 'live', 'document', 'extract', 'optimize',
])

export const flowById = (id: FlowId): Flow => FLOWS.find(f => f.id === id) ?? FLOWS[0]!

export const isFlowId = (value: string): value is FlowId => FLOWS.some(f => f.id === value)

export const parseRun = (args: string): Run | undefined => {
  const [command = '', ...rest] = args.trim().split(/\s+/)
  const name = command.toLowerCase()

  return ALL.has(name) ? { command: name, target: rest.join(' ') } : undefined
}

const isFix = (step: Step) => step.commands.length > 2

export type Progress = {
  statuses: Status[]
  next: { step: Step; command: string } | undefined
  // Optional steps that can run before `next`.
  optional: Step[]
  isComplete: boolean
  target: string
}

export const progress = (id: FlowId, runs: readonly Run[]): Progress => {
  const { steps } = flowById(id)
  const statuses: Status[] = steps.map(() => 'todo')
  let at = 0

  const passTo = (found: number, covers?: readonly string[]) => {
    for (let i = at; i < found; i++) {
      statuses[i] = covers?.some(c => steps[i]!.commands.includes(c)) ? 'done' : 'skipped'
    }
  }

  for (const { command } of runs) {
    if (command === SKIP.command) {
      let found = at

      while (found < steps.length && steps[found]!.isOptional) {
        found++
      }

      if (found < steps.length) {
        passTo(found)
        statuses[found] = 'skipped'
        at = found + 1
      }

      continue
    }

    // Running the step just done again (a second critique) is a re-run, not progress.
    if (at > 0 && statuses[at - 1] === 'done' && steps[at - 1]!.commands.includes(command)) {
      continue
    }

    const found = steps.findIndex((step, i) => i >= at && step.commands.includes(command))

    if (found < 0) {
      continue
    }

    passTo(found, steps[found]!.covers)
    statuses[found] = 'done'
    at = found + 1
  }

  const optional: Step[] = []
  let nextIndex = at

  while (nextIndex < steps.length && steps[nextIndex]!.isOptional) {
    optional.push(steps[nextIndex]!)
    nextIndex++
  }

  const nextStep = steps[nextIndex]

  if (nextStep !== undefined) {
    statuses[nextIndex] = 'current'
  }

  return {
    statuses,
    next: nextStep && { step: nextStep, command: isFix(nextStep) ? '<fix>' : nextStep.commands[0]! },
    optional,
    isComplete: nextStep === undefined,
    target: runs.findLast(r => r.target !== '')?.target ?? '',
  }
}

export type Row =
  | { kind: 'step'; label: string; status: Status }
  | { kind: 'optional'; items: { label: string; isRun: boolean }[] }

export type Summary = Progress & {
  flow: Flow
  rows: Row[]
  // 1-based place of the next step among the required steps.
  stepNumber: number
  requiredTotal: number
  requiredDone: number
  // The targeted commands to choose from, when the next step is a fix.
  fixes: readonly Fix[] | undefined
}

export const summarize = (id: FlowId, runs: readonly Run[]): Summary => {
  const flow = flowById(id)
  const p = progress(id, runs)
  const rows: Row[] = []

  flow.steps.forEach((step, i) => {
    const status = p.statuses[i]!

    if (!step.isOptional) {
      rows.push({ kind: 'step', label: step.label, status })

      return
    }

    const item = { label: isFix(step) ? 'second fix' : step.commands[0]!, isRun: status === 'done' }
    const last = rows.at(-1)

    if (last?.kind === 'optional') {
      last.items.push(item)
    } else {
      rows.push({ kind: 'optional', items: [item] })
    }
  })

  const required = flow.steps.flatMap((step, i) => (step.isOptional ? [] : [p.statuses[i]!]))
  const passed = required.filter(s => s === 'done' || s === 'skipped').length

  return {
    ...p,
    flow,
    rows,
    stepNumber: Math.min(passed + 1, required.length),
    requiredTotal: required.length,
    requiredDone: passed,
    fixes: p.next && isFix(p.next.step) ? FIXES : undefined,
  }
}

export const commandFor = (command: string, target: string) =>
  `/impeccable ${command} ${target === '' ? '<target>' : target}`

const MARKS: Record<Status, string> = { done: '✓', current: '●', skipped: '–', todo: '○' }

// The flow as plain text, for surfaces that cannot draw the pane.
export const describeFlow = (id: FlowId | null, runs: readonly Run[], target = ''): string => {
  if (id === null) {
    return [
      'No flow chosen. Pick one:',
      ...FLOWS.map(f => `  /impeccable-flow ${f.id}  ${f.summary}`),
    ].join('\n')
  }

  const s = summarize(id, runs)
  const head = `${s.flow.label}${target === '' ? '' : `: ${target}`}`
  const list = s.rows.map(row =>
    row.kind === 'step'
      ? `  ${MARKS[row.status]} ${row.label}${row.status === 'skipped' ? ' (skipped)' : ''}`
      : `  + Optional: ${row.items.map(item => (item.isRun ? `✓ ${item.label}` : item.label)).join(' · ')}`,
  )

  if (s.next === undefined) {
    return [head, '', 'Flow complete. /impeccable-flow reset to start again.', '', ...list].join('\n')
  }

  const action = s.fixes
    ? s.fixes.map(f => `  ${commandFor(f.command, target)}  (${f.use})`)
    : [`  ${commandFor(s.next.command, target)}`]

  return [
    head,
    '',
    `Next: ${s.next.step.label} (step ${s.stepNumber} of ${s.requiredTotal})`,
    ...action,
    `  ${s.next.step.hint}`,
    '',
    ...list,
  ].join('\n')
}

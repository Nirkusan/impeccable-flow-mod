import type { FlowId, Run } from '../types'

export type Step = {
  label: string
  commands: readonly string[]
  hint: string
  isOptional?: true
  // A step whose command also does an earlier step (craft runs shape itself).
  covers?: readonly string[]
}

export type Flow = { id: FlowId; label: string; steps: readonly Step[] }

export type Status = 'done' | 'skipped' | 'current' | 'todo'

const TARGETED = ['layout', 'typeset', 'clarify', 'quieter', 'bolder', 'distill', 'colorize', 'adapt', 'harden']

const TARGETED_HINT =
  'Pick from the critique: layout (spacing, hierarchy), typeset (type), clarify (copy), quieter, bolder, distill (clutter), colorize, adapt (mobile), harden (edge cases).'

export const FLOWS: readonly Flow[] = [
  {
    id: 'component',
    label: 'New component',
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
    label: 'Full redesign',
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
    steps: [
      { label: 'Critique or audit', commands: ['critique', 'audit'], hint: 'Critique for UX issues, audit for technical ones.' },
      { label: 'Fix', commands: TARGETED, hint: TARGETED_HINT },
      { label: 'Second fix', commands: TARGETED, isOptional: true, hint: TARGETED_HINT },
      { label: 'Polish', commands: ['polish'], hint: 'Final pass on the details.' },
    ],
  },
]

const ALL = new Set([
  ...FLOWS.flatMap(f => f.steps.flatMap(s => s.commands)),
  'init', 'live', 'document', 'extract', 'optimize',
])

export const flowById = (id: FlowId): Flow => FLOWS.find(f => f.id === id) ?? FLOWS[0]!

export const parseRun = (args: string): Run | undefined => {
  const [command = '', ...rest] = args.trim().split(/\s+/)
  const name = command.toLowerCase()

  return ALL.has(name) ? { command: name, target: rest.join(' ') } : undefined
}

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

  for (const { command } of runs) {
    // Running the step just done again (a second critique) is a re-run, not progress.
    if (at > 0 && steps[at - 1]!.commands.includes(command)) {
      continue
    }

    const found = steps.findIndex((step, i) => i >= at && step.commands.includes(command))

    if (found < 0) {
      continue
    }

    const step = steps[found]!

    for (let i = at; i < found; i++) {
      const covered = step.covers?.some(c => steps[i]!.commands.includes(c))
      statuses[i] = covered ? 'done' : 'skipped'
    }

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
    next: nextStep && { step: nextStep, command: nextStep.commands.length > 2 ? '<fix>' : nextStep.commands[0]! },
    optional,
    isComplete: nextStep === undefined,
    target: runs.findLast(r => r.target !== '')?.target ?? '',
  }
}

const MARKS: Record<Status, string> = { done: '✓', current: '›', skipped: '–', todo: '○' }

export const nextCommand = (p: Progress): string | undefined =>
  p.next && `/impeccable ${p.next.command} ${p.target === '' ? '<target>' : p.target}`

// The flow as plain text, for surfaces that cannot draw the pane.
export const describeFlow = (id: FlowId | null, runs: readonly Run[]): string => {
  if (id === null) {
    return [
      'No flow chosen. Pick one:',
      ...FLOWS.map(f => `  /impeccable-flow ${f.id}  (${f.label})`),
    ].join('\n')
  }

  const flow = flowById(id)
  const p = progress(id, runs)
  const lines = [
    `${flow.label}${p.target === '' ? '' : `: ${p.target}`}`,
    ...flow.steps.map((step, i) => {
      const status = p.statuses[i]!
      const notes = [step.isOptional && 'optional', status === 'skipped' && !step.isOptional && 'skipped'].filter(Boolean)

      return `  ${MARKS[status]} ${step.label}${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`
    }),
    '',
  ]

  if (p.next === undefined) {
    return [...lines, 'Flow complete. /impeccable-flow reset to start on another target.'].join('\n')
  }

  return [
    ...lines,
    `Next: ${p.next.step.label}`,
    `  ${nextCommand(p)}`,
    `  ${p.next.step.hint}`,
    ...(p.optional.length > 0 ? [`  Optional first: ${p.optional.map(s => s.label.toLowerCase()).join(', ')}`] : []),
  ].join('\n')
}

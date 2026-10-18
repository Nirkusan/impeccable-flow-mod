import { describe, expect, test } from 'claude-code/testing'

import { SKIP, describeFlow, parseRun, progress, summarize } from '../hooks/flows'

const run = (command: string, target = 'tailor') => ({ command, target })

describe('parseRun', () => {
  test('reads the command and the target', () => {
    expect(parseRun('critique tailor page')).toEqual({ command: 'critique', target: 'tailor page' })
  })

  test('ignores anything that is not an impeccable command', () => {
    expect(parseRun('')).toBeUndefined()
    expect(parseRun('make it nicer')).toBeUndefined()
  })
})

describe('progress', () => {
  test('a fresh redesign suggests critique first', () => {
    const p = progress('redesign', [])
    expect(p.next?.command).toBe('critique')
    expect(p.statuses[0]).toBe('current')
  })

  test('redesign advances step by step and ends with a re-score', () => {
    const p = progress('redesign', [run('critique'), run('shape'), run('craft'), run('audit'), run('polish')])
    expect(p.statuses.slice(0, 5)).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(p.next?.command).toBe('critique')
    expect(p.next?.step.label).toMatch(/re-score/i)
  })

  test('a repeated critique does not jump to the final re-score', () => {
    const p = progress('redesign', [run('critique'), run('critique')])
    expect(p.next?.command).toBe('shape')
  })

  test('craft covers shape in the new-component flow', () => {
    const p = progress('component', [run('craft')])
    expect(p.statuses[0]).toBe('done')
    expect(p.statuses[1]).toBe('done')
  })

  test('after craft, optional steps are offered beside audit', () => {
    const p = progress('component', [run('craft')])
    expect(p.next?.command).toBe('audit')
    expect(p.optional.map(s => s.commands[0])).toEqual(['onboard', 'animate', 'harden'])
  })

  test('polish flow accepts audit as the diagnosis and a targeted fix', () => {
    const p = progress('polish', [run('audit'), run('typeset')])
    expect(p.statuses.slice(0, 2)).toEqual(['done', 'done'])
    expect(p.next?.command).toBe('polish')
    expect(p.optional).toHaveLength(1)
  })

  test('a finished flow has no next step', () => {
    const p = progress('polish', [run('critique'), run('layout'), run('polish')])
    expect(p.isComplete).toBe(true)
    expect(p.next).toBeUndefined()
  })

  test('the latest target is remembered', () => {
    expect(progress('polish', [run('critique', 'jobs'), run('layout', 'jobs page')]).target).toBe('jobs page')
  })
})

describe('describeFlow', () => {
  test('without a flow it lists the choices', () => {
    expect(describeFlow(null, [])).toContain('/impeccable-flow redesign')
  })

  test('with a flow it lists the steps and the next command', () => {
    const text = describeFlow('redesign', [run('critique', 'tailor')], 'tailor')
    expect(text).toContain('✓ Critique')
    expect(text).toContain('Next: Shape (step 2 of 6)')
    expect(text).toContain('/impeccable shape tailor')
    expect(text.indexOf('Next:')).toBeLessThan(text.indexOf('✓ Critique'))
  })
})

describe('skip', () => {
  test('a skip marks the current step skipped and moves on', () => {
    const p = progress('redesign', [run('critique'), SKIP])
    expect(p.statuses[1]).toBe('skipped')
    expect(p.next?.command).toBe('craft')
  })

  test('a skip passes over optional steps to the next required one', () => {
    const p = progress('component', [run('craft'), SKIP])
    expect(p.statuses[5]).toBe('skipped')
    expect(p.next?.command).toBe('polish')
  })
})

describe('summarize', () => {
  test('counts required steps only', () => {
    const s = summarize('component', [run('craft')])
    expect(s.stepNumber).toBe(3)
    expect(s.requiredTotal).toBe(5)
    expect(s.requiredDone).toBe(2)
  })

  test('groups consecutive optional steps into one row', () => {
    const s = summarize('component', [run('craft'), run('animate')])
    const optional = s.rows.find(r => r.kind === 'optional')
    expect(optional).toEqual({
      kind: 'optional',
      items: [
        { label: 'onboard', isRun: false },
        { label: 'animate', isRun: true },
        { label: 'harden', isRun: false },
      ],
    })
    expect(s.rows.filter(r => r.kind === 'step')).toHaveLength(5)
  })

  test('the polish fix step offers the targeted commands', () => {
    const s = summarize('polish', [run('critique')])
    expect(s.fixes?.map(f => f.command)).toContain('layout')
    expect(s.fixes).toHaveLength(9)
  })
})

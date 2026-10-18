import { describe, expect, test } from 'claude-code/testing'

import { describeFlow, parseRun, progress } from '../hooks/flows'

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
    const text = describeFlow('redesign', [run('critique', 'tailor')])
    expect(text).toContain('✓ Critique')
    expect(text).toContain('Next: Shape')
    expect(text).toContain('/impeccable shape tailor')
  })
})

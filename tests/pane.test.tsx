import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'impeccable-flow',
  component: 'Pane',
  requestId: 'impeccable-flow',
  props: {
    title: 'Impeccable flow',
    isFocused: false,
    bodyColumns: 34,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('choosing a flow shows the next command first', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Critique first, rebuild/ })).toBeDefined()

    await ui.select({ key: 'flow', value: 'redesign' })
    expect(await ui.find({ type: 'Text', text: 'Step 1 of 6' })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/impeccable critique <target>')

    await ui.input({ key: 'target', text: 'tailor', kind: 'change' })
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/impeccable critique tailor')

    await ui.press({ key: 'reset' })
    await ui.unmount()
  }
})

test('skip moves to the next step without a toast', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'redesign' })
  await ui.press({ key: 'skip' })
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 6' })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/impeccable shape <target>')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('a Skill call to impeccable advances the flow and sets the target', async ($, on) => {
  on('tool.call', () => ({ result: { success: true, commandName: 'impeccable' } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'polish' })
  await $.tool.call({ tool: 'Skill', skill: 'impeccable', args: 'audit jobs' })
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 3' })).toBeDefined()
  expect(await ui.find({ key: 'fix-layout' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('finishing a flow offers Start again, which keeps the target', async ($, on) => {
  on('tool.call', () => ({ result: { success: true, commandName: 'impeccable' } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'polish' })
  for (const args of ['critique jobs', 'layout jobs', 'polish jobs']) {
    await $.tool.call({ tool: 'Skill', skill: 'impeccable', args })
  }
  expect(await ui.find({ type: 'Text', text: 'Flow complete' })).toBeDefined()
  await ui.press({ key: 'start-again' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/impeccable critique jobs')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('mobile falls back to flow buttons and a read-only target', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'flow-polish' })
  expect(await ui.find({ type: 'Text', text: /Target: set by the next command/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 3' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

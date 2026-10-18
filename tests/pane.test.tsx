import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'impeccable-flow',
  component: 'Pane',
  requestId: 'impeccable-flow',
  props: {
    title: 'Impeccable flow',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('choosing a flow shows its steps and the next command', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Choose a flow/ })).toBeDefined()

    await ui.press({ key: 'flow-redesign' })
    expect((await ui.find({ key: 'next' }))?.text).toContain('/impeccable critique')

    await ui.press({ key: 'reset' })
    await ui.unmount()
  }
})

test('a Skill call to impeccable advances the flow', async ($, on) => {
  on('tool.call', () => ({ result: { success: true, commandName: 'impeccable' } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'flow-polish' })
  await $.tool.call({ tool: 'Skill', skill: 'impeccable', args: 'audit jobs' })
  const next = await ui.find({ key: 'next' })
  expect(next?.text).toContain('Fix')
  expect(await ui.find({ type: 'Text', text: /Target: jobs/ })).toBeDefined()
  await ui.unmount()
})

export type FlowId = 'component' | 'redesign' | 'polish'
export type Run = { command: string; target: string }

declare module 'claude-code' {
  interface PluginState {
    'impeccable-flow': { flow: FlowId | null; runs: Run[] }
  }
}

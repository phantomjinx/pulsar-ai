/**
 * A map of default model names for each supported provider.
 * These are chosen as good, general-purpose defaults.
 */
export const models: { [key: string]: string[] } = {
  google: ['gemini-1.5-flash-latest'],
  openai: ['gpt-4o-mini', 'gpt-4o' ],
  claude: ['claude-3-opus-latest', 'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest' ],
  mistral: ['mistral-large-latest', 'mistral-medium', 'mistral-small' ],
}

export type Message = {
  role: any,
  content: string,
  metadata: any
}

export type PulsarAIState = {
  // This is the "name tag" attached to the data
  deserializer: string
  // Model provider previously chosen, eg. google
  modelProvider?: string
  // Model name previously chosen, eg. gemini-flash
  modelName?: string
  // Messages sent to the AI that formed the prompt
  messages?: Message[]
}

export interface PulsarAIViewOptions {
  state?: PulsarAIState
  stateUpdated?: (state: PulsarAIState) => void
}

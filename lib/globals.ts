/**
 * A map of default model names for each supported provider.
 * These are chosen as good, general-purpose defaults.
 */
export const models: { [key: string]: string[] } = {
  anthropic: ['claude-3-opus-latest', 'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  google: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  mistral: ['mistral-large-latest', 'mistral-medium', 'mistral-small'],
  openai: ['gpt-4o-mini', 'gpt-4o']
}

export type ModelMetadata = {
  sessionId: string
  provider: string
  name: string
}

export enum Role {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export interface CodeSelection {
  filePath?: string,
  selection: Partial<Range>
}

export interface EditorMetadata {
  codeSelection?: CodeSelection
}

export type Message = {
  role: Role,
  content: string,
  summary?: boolean,
  metadata?: EditorMetadata
}

export type MessageCtxState = {
  history: Message[],
  contextWindow: Message[]
}

export type PulsarAIState = {
  // This is the "name tag" attached to the data
  deserializer: string

  // Model Metadata, eg. google and gemini-flash
  modelMetadata: ModelMetadata

  // Messages sent to the AI that formed the prompt
  messageContext?: MessageCtxState
}

export interface PulsarAIViewOptions {
  state?: PulsarAIState
  stateUpdated?: (state: PulsarAIState) => void
}

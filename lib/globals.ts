/**
 * A map of default model names for each supported provider.
 * These are chosen as good, general-purpose defaults.
 */
export const models: { [key: string]: string[] } = {
  google: ['gemini-1.5-flash-latest'],
  openai: ['gpt-4o-mini', 'gpt-4o' ],
  claude: ['claude-3-opus-latest', 'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest' ],
  mistral: ['mistral-large-latest', 'mistral-medium', 'mistral-small' ],
};

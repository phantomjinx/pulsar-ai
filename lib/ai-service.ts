import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { HumanMessage } from "@langchain/core/messages"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Map of model prefixes to their LangChain class constructors
const modelMap: Record<string, () => BaseChatModel> = {
  'gpt-': () => new ChatOpenAI(
    {
      apiKey: atom.config.get('pulsar-ai.openaiApiKey')
    }
  ),
  'claude-': () => new ChatAnthropic(
    {
      apiKey: atom.config.get('pulsar-ai.anthropicApiKey')
    }
  ),
  'mistral-': () => new ChatOpenAI(
    { // Mistral can use the OpenAI-compatible API endpoint
      apiKey: atom.config.get('pulsar-ai.mistralApiKey'),
      baseURL: 'https://api.mistral.ai/v1/',
    }
  ),
  'gemini-': () => new ChatGoogleGenerativeAI(
    {
      apiKey: atom.config.get('pulsar-ai.geminiApiKey')
    }
  ),
}

class AIService {
  endpoints: {
    openai: string
    anthropic: string
    mistral: string
  }

  constructor() {
    // Endpoint Map by Provider
    this.endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      mistral: 'https://api.mistral.ai/v1/chat/completions'
    }
  }

  // Retrieves the API key for a given model
  getApiKey(model) {
    if (model.startsWith('gpt-')) {
      return atom.config.get('pulsar-ai.openaiApiKey')
    } else if (model.startsWith('claude-')) {
      return atom.config.get('pulsar-ai.anthropicApiKey')
    } else if (model.startsWith('mistral-')) {
      return atom.config.get('pulsar-ai.mistralApiKey')
    } else if (model.startWith('gemini-')) {
      return atom.config.get('pulsar-ai.geminiApiKey')
    }
    throw new Error(`Unrecognized model : ${model}`)
  }

  // Determines the provider from the model
  getProvider(model) {
    if (model.startsWith('gpt-')) return 'openai'
    if (model.startsWith('claude-')) return 'anthropic'
    if (model.startsWith('mistral-')) return 'mistral'
    throw new Error(`Supplier not recognized for the model : ${model}`)
  }

  // Formats the query according to the provider
  formatRequest(provider, model, messages) {
    const headers = {
      'Content-Type': 'application/json'
    }

    switch (provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.getApiKey(model)}`
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          })
        }

      case 'anthropic':
        headers['x-api-key'] = this.getApiKey(model)
        headers['anthropic-version'] = '2023-06-01'
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            messages: messages.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          })
        }

      case 'mistral':
        headers['Authorization'] = `Bearer ${this.getApiKey(model)}`
        return {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          })
        }

      default:
        throw new Error(`Unsupported Provider: ${provider}`)
    }
  }

  // Parse the response according to the provider
  parseResponse(provider, response) {
    switch (provider) {
      case 'openai':
        return {
          role: 'assistant',
          content: response.choices[0].message.content
        }

      case 'anthropic':
        return {
          role: 'assistant',
          content: response.content[0].text
        }

      case 'mistral':
        return {
          role: 'assistant',
          content: response.choices[0].message.content
        }

      default:
        throw new Error(`Unsupported Provider: ${provider}`)
    }
  }

  // Checks if an API key is valid
  validateApiKey(model) {
    const key = this.getApiKey(model)
    if (!key) {
      const provider = this.getProvider(model)
      throw new Error(`Missing API key for ${provider}`)
    }
    return true
  }

  // Primary method to send a message
  async sendMessage(model, messages) {
    try {
      this.validateApiKey(model)
      const provider = this.getProvider(model)
      const endpoint = this.endpoints[provider]

      const requestOptions = this.formatRequest(provider, model, messages)

      const response = await fetch(endpoint, requestOptions)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`API Error ${provider}: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      return this.parseResponse(provider, data)

    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }
}

export const aiService = new AIService()

import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatMistralAI } from '@langchain/mistralai'
import { StringOutputParser } from '@langchain/core/output_parsers'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history"
import { Message, ModelMetadata, Role } from './globals'
import { isError } from './utils'
import { MessageContext } from './message-context'

export const SUMMARY_PREFIX = 'SUMMARY of earlier conversation'

// Define the output parser
const outputParser = new StringOutputParser()

class AIService {

  // Determines the provider from the model
  private getProvider(modelMetadata: ModelMetadata) {
    if (! modelMetadata || ! modelMetadata.provider)
      throw new Error('Provider not recognized for the model')

    return modelMetadata.provider
  }

  // Checks if an API key is valid
  private validateApiKey(modelMetadata: ModelMetadata): string {
    // Retrieves the API key from config settings
    const apiKey = atom.config.get('pulsar-ai.apiKey')

    if (!apiKey) {
      const provider = this.getProvider(modelMetadata)
      throw new Error(`Missing API key for ${provider}`)
    }

    return apiKey
  }

  private async getChatModel(modelMetadata: ModelMetadata): Promise<BaseChatModel> {
    // return new MockChatModel()
    const apiKey = this.validateApiKey(modelMetadata)
    const provider = modelMetadata.provider
    const name = modelMetadata.name
    const temperature = 0.2

    if (!name || name.length === 0) {
      throw new Error(`Cannot find a model name to use for the provider ${provider}. Please specify the LLM_NAME env var`)
    }

    console.log(`Using ${provider} model ${name}`)

    switch (provider) {
      case 'anthropic':
        if (!apiKey) {
          throw new Error('Anthropic requires an api key. Cannot initialize Claude model.')
        }
        return new ChatAnthropic({
          apiKey: apiKey,
          model: name,
          temperature,
          maxRetries: 0
        })
      case 'google':
        if (!apiKey) {
          throw new Error('Google requires an api key. Cannot initialize Google Gemini model.')
        }
        return new ChatGoogleGenerativeAI({
          apiKey: apiKey,
          model: name,
          temperature,
          maxRetries: 0
        })
      case 'openai':
        if (!apiKey) {
          throw new Error('OpenAI requires an api key. Cannot initialize ChatGPT model.')
        }
        return new ChatOpenAI({
          apiKey: apiKey,
          model: name,
          temperature,
          maxRetries: 0
        })
      case 'mistral':
        if (!apiKey) {
          throw new Error('Mistral requires an api key. Cannot initialize Mistral model.')
        }
        return new ChatMistralAI({
          apiKey: apiKey,
          model: name,
          temperature,
          maxRetries: 0
        })
      default:
        throw new Error(`Unknown AI provider specified: '${provider}'`)
    }
  }

  async summarize(messagesToSummarize: Message[], chatModel: BaseChatModel, previousSummary?: Message): Promise<Message> {
    console.log(`ai-service: summarizing ${messagesToSummarize.length} old messages...`, messagesToSummarize)
    const conversationText = messagesToSummarize.map(m => `${m.role}: ${m.content}`).join('\n')

    let summarizationPrompt: string
    if (previousSummary) {
      const prevSummaryText = previousSummary.content.replace(`${SUMMARY_PREFIX}: `, '')
      summarizationPrompt = `Below is an existing summary of our earlier conversation. Please create a new, single, consolidated summary by incorporating the key information from the 'NEW MESSAGES' that follow.\n\nEXISTING SUMMARY:\n${prevSummaryText}\n\nNEW MESSAGES:\n${conversationText}`
    } else {
      summarizationPrompt = `Summarize the following conversation concisely into a single paragraph. Capture the key facts, user intent, and important information.\n\nCONVERSATION:\n${conversationText}`
    }

    const summaryResult = await chatModel.invoke(summarizationPrompt)
    const summaryText = summaryResult.content as string

    const summaryMsg = {
      role: Role.User,
      content: `${SUMMARY_PREFIX}: ${summaryText}`,
      summary: true
    }
    return summaryMsg
  }

  private convertMessages(msgs: Message[]): BaseMessage[] {
    return msgs.map(msg => {
      if (msg.role === Role.User) return new HumanMessage(msg.content)
      if (msg.role === Role.Assistant) return new AIMessage(msg.content)
      return new SystemMessage(msg.content)
    })
  }

  // Primary method to send a message
  async sendMessage(modelMetadata: ModelMetadata, messageCtx: MessageContext): Promise<boolean> {
    try {
      const chatModel = await this.getChatModel(modelMetadata)

      const ctxWindow = await messageCtx.prepareSubmission(chatModel)
      if (ctxWindow.length === 0) {
        throw new Error('No messages in context')
      }
      console.log('ai-service: context window:', ctxWindow)

      const userMessage = ctxWindow[ctxWindow.length - 1]
      const history = ctxWindow.slice(0, -1)

      console.log('ai-service: submission user message: ', userMessage)
      console.log('ai-service: submission history', history)

      if (! userMessage) {
        throw new Error('No user message to submit')
      }

      if (userMessage.role !== Role.User) {
        throw new Error('The last message must be from the user.')
      }

      const historyStore = new InMemoryChatMessageHistory(this.convertMessages(history))

      const prompt = ChatPromptTemplate.fromMessages([
        [Role.System, 'You are a helpful assistant. Answer all questions to the best of your ability.'],
        new MessagesPlaceholder('chat_history'), // Use the placeholder
        [Role.User, '{input}'],
      ])

      const runnable = prompt.pipe(chatModel).pipe(outputParser)

      const chainWithHistory = new RunnableWithMessageHistory({
        runnable: runnable,
        inputMessagesKey: 'input',
        historyMessagesKey: 'chat_history',
        getMessageHistory: async () => historyStore
      })

      const response = await chainWithHistory.invoke(
        { input: userMessage.content },
        { configurable: { sessionId: modelMetadata.sessionId } }
      )

      const responseMsg = {
        role: Role.Assistant,
        content: response,
        metadata: userMessage.metadata
      }

      messageCtx.addMessage(responseMsg)

      return true

    } catch (error) {
      const msg = isError(error) ? error.message : '<unknown>'
      const wrapped = new Error(`Error sending message to AI Service ${modelMetadata.provider}:${modelMetadata.name}: ${msg}`)
      throw wrapped
    }
  }
}

export const aiService = new AIService()

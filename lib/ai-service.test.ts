// ai-service.test.ts

import { Message, ModelMetadata, models, Role } from './globals'
import { aiService } from './ai-service'
import { MessageContext } from './message-context'

// --- Mock Dependencies ---
// Mock atom.config.get
// @ts-ignore
global.atom = { config: { get: jest.fn() } }

const mockPrepareSubmission = jest.fn()
const mockAddMessage = jest.fn()
jest.mock('./message-context', () => {
  return {
    MessageContext: jest.fn().mockImplementation(() => {
      return {
        prepareSubmission: mockPrepareSubmission,
        addMessage: mockAddMessage,
      }
    }),
  }
})

const mockInvoke = jest.fn()
jest.mock('@langchain/core/runnables', () => ({
  RunnableWithMessageHistory: jest.fn().mockImplementation(() => ({
    invoke: mockInvoke,
  })),
}))

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn(() => ({ pipe: jest.fn().mockReturnThis() })),
  },
  MessagesPlaceholder: jest.fn(),
}))

const mockChatModel = {} as any

describe('AIService', () => {
  let mockMessageContext: MessageContext

  beforeEach(() => {
    // Reset all mocks before each test
    mockInvoke.mockClear()
    mockPrepareSubmission.mockClear()
    mockAddMessage.mockClear()
    // Create a new mock instance for each test
    mockMessageContext = new MessageContext()
  })

  test('sendMessage', async () => {
    (atom.config.get as jest.Mock).mockReturnValue('sss-ppp')

    const getChatModelSpy = jest
      .spyOn(aiService as any, 'getChatModel')
      .mockResolvedValue(mockChatModel)

    // The MessageContext will return this processed context
    const processedContext: Message[] = [
      { role: Role.System, content: 'System Prompt' },
      { role: Role.User, content: 'User Input' },
    ]
    mockPrepareSubmission.mockResolvedValue(processedContext)

    // The AI (mocked invoke) will return this content
    const aiResponseContent = 'This is the AI response.'
    mockInvoke.mockResolvedValue(aiResponseContent)

    // Create a mock modelMetadata object with the required properties
    const mockModelMetadata: ModelMetadata = {
      provider: 'google', // Or another valid provider string
      name: models['google'][0],
      sessionId: 'test-session-123',
    }

    const result = await aiService.sendMessage(
      mockModelMetadata,
      mockMessageContext // The mocked MessageContext instance
    )

    expect(getChatModelSpy).toHaveBeenCalledTimes(1)

    // Did the service ask the context for the message list?
    expect(mockPrepareSubmission).toHaveBeenCalledTimes(1)
    expect(mockPrepareSubmission).toHaveBeenCalledWith(mockChatModel)

    // Did the service invoke the LangChain runnable with the correct input?
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith(
      { input: 'User Input' }, // The last message from our mocked context
      expect.anything()
    )

    // Did the service add the AI's response back into the context?
    expect(mockAddMessage).toHaveBeenCalledTimes(1)
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.Assistant,
        content: aiResponseContent,
      })
    )

    // Did the service return `true` on success?
    expect(result).toBe(true)
  })
})
